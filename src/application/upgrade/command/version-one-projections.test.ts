import { describe, expect, it, vi } from "vitest";
import type { SelectionRepository } from "../../../infrastructure/disciplines-file/consumer-selection.ts";
import type { CheckRequest } from "../../run/check/run-check.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import { createPathPort } from "../../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../../infrastructure/hone-config-file/assessment.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRepository } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { type VersionOneProject, versionOneProjectionsOfRepository } from "./version-one-projections.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");

const ORPHAN = repoPathSchema.parse("old/disciplines.eslint.mjs");

const CONFIG = repoPathSchema.parse("eslint.config.mjs");

const CONFIG_TEXT = 'import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n';

const CHECK: CheckRequest = {
  repoRoot: REPO_ROOT,
  installRoot: absolutePathSchema.parse("/install"),
  moduleExtension: ".ts",
  baseRevision: undefined,
  assessment: DEFAULT_ASSESSMENT,
  fileText: { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>() },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  path,
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  selectionRepository: { read: vi.fn<SelectionRepository["read"]>() },
  exceptionRepository: { read: vi.fn<ExceptionRepository["read"]>(), readAt: vi.fn<ExceptionRepository["readAt"]>() },
};

const fileTextHolding = (request: { readonly configText: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.configText }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

const requestOver = (request: { readonly project: VersionOneProject; readonly fileText: FileTextPort }) => ({
  project: request.project,
  check: CHECK,
  fileText: request.fileText,
  path,
  repoRoot: REPO_ROOT,
  trackedPaths: [CONFIG, PROJECTION],
});

const projecting = (request: { readonly writes: readonly ProjectionWrite[] }) =>
  vi.fn<VersionOneProject>().mockResolvedValue({ outcome: "ok", value: request.writes });

const FOUND = [{ projection: "disciplines.eslint.mjs", teamConfigs: [{ file: "eslint.config.mjs", text: CONFIG_TEXT }] }];

describe("versionOneProjectionsOfRepository", () => {
  it("runs version 1's project over the check with the file text port, and pairs each unchanged projection with the config that imports it", async () => {
    const project = projecting({ writes: [{ path: PROJECTION, effect: "unchanged" }] });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });
    await expect(versionOneProjectionsOfRepository(requestOver({ project, fileText }))()).resolves.toEqual({
      removed: [],
      outcome: { outcome: "ok", value: FOUND },
    });
    expect(project).toHaveBeenCalledExactlyOnceWith({ ...CHECK, fileText });
  });

  it("names the slice version 1's project removed, and lists no projection for it", async () => {
    const project = projecting({
      writes: [
        { path: PROJECTION, effect: "unchanged" },
        { path: ORPHAN, effect: "removed" },
      ],
    });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });
    await expect(versionOneProjectionsOfRepository(requestOver({ project, fileText }))()).resolves.toEqual({
      removed: ["old/disciplines.eslint.mjs"],
      outcome: { outcome: "ok", value: FOUND },
    });
  });

  it("refuses naming the projection when no tracked file imports it", async () => {
    const project = projecting({ writes: [{ path: PROJECTION, effect: "unchanged" }] });
    const fileText = fileTextHolding({ configText: "export default [];\n" });
    await expect(versionOneProjectionsOfRepository(requestOver({ project, fileText }))()).resolves.toEqual({
      removed: [],
      outcome: { outcome: "failed", error: { kind: "team-config-refused", refusal: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } } },
    });
  });

  it("refuses naming the load failure's detail when version 1's project fails", async () => {
    const failure: LoadFailure = { kind: "git-failed", detail: "git ls-files: not a git repository" };
    const project = vi.fn<VersionOneProject>().mockResolvedValue({ outcome: "failed", error: failure });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });
    await expect(versionOneProjectionsOfRepository(requestOver({ project, fileText }))()).resolves.toEqual({
      removed: [],
      outcome: { outcome: "failed", error: { kind: "project-failed", detail: "git-failed git ls-files: not a git repository" } },
    });
  });
});
