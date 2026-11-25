import { describe, expect, it, vi } from "vitest";

import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import type { ProofWrites } from "../proof-writes/proof-writes.ts";
import {
  type VersionOneProject,
  versionOneProjectionsOfRepository,
} from "./version-one-projections.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const path: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/eslint.config.mjs"),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const loadFailureDetail: LoadFailureDetail = () => "git-failed git ls-files: not a git repository";

const PROJECTION = repoPathOf("disciplines.eslint.mjs");

const ORPHAN = repoPathOf("old/disciplines.eslint.mjs");

const CONFIG = repoPathOf("eslint.config.mjs");

const CONFIG_TEXT =
  'import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n';

const fileTextHolding = (request: { readonly configText: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.configText }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

const RECORDED: ProofWrites = [
  { kind: "file-created", path: absoluteRootOf("/repo/disciplines.eslint.mjs") },
];

const requestOver = (request: {
  readonly project: VersionOneProject;
  readonly fileText: FileTextPort;
}) => ({
  project: request.project,
  writes: () => RECORDED,
  loadFailureDetail,
  fileText: request.fileText,
  path,
  repoRoot: REPO_ROOT,
  trackedPaths: [CONFIG, PROJECTION],
});

const projecting = (request: { readonly writes: readonly ProjectionWrite[] }) =>
  vi.fn<VersionOneProject>().mockResolvedValue({ outcome: "ok", value: request.writes });

const FOUND = [
  {
    projection: "disciplines.eslint.mjs",
    teamConfigs: [{ file: "eslint.config.mjs", text: CONFIG_TEXT }],
  },
];

describe("versionOneProjectionsOfRepository", () => {
  it("pairs each unchanged projection prepared for upgrade with the config that imports it", async () => {
    const project = projecting({ writes: [{ path: PROJECTION, effect: "unchanged" }] });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });
    await expect(
      versionOneProjectionsOfRepository(requestOver({ project, fileText }))(),
    ).resolves.toEqual({
      written: RECORDED,
      removed: [],
      outcome: { outcome: "ok", value: FOUND },
    });
    expect(project).toHaveBeenCalledExactlyOnceWith();
  });

  it("pairs a projection version 1's project created with the config that imports it", async () => {
    const project = projecting({ writes: [{ path: PROJECTION, effect: "written" }] });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });

    const reading = await versionOneProjectionsOfRepository(requestOver({ project, fileText }))();

    expect(reading).toEqual({
      written: RECORDED,
      removed: [],
      outcome: { outcome: "ok", value: FOUND },
    });
  });

  it("names the slice version 1's project removed, and lists no projection for it", async () => {
    const project = projecting({
      writes: [
        { path: PROJECTION, effect: "unchanged" },
        { path: ORPHAN, effect: "removed" },
      ],
    });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });
    await expect(
      versionOneProjectionsOfRepository(requestOver({ project, fileText }))(),
    ).resolves.toEqual({
      written: RECORDED,
      removed: ["old/disciplines.eslint.mjs"],
      outcome: { outcome: "ok", value: FOUND },
    });
  });

  it("refuses naming the projection when no tracked file imports it", async () => {
    const project = projecting({ writes: [{ path: PROJECTION, effect: "unchanged" }] });
    const fileText = fileTextHolding({ configText: "export default [];\n" });
    await expect(
      versionOneProjectionsOfRepository(requestOver({ project, fileText }))(),
    ).resolves.toEqual({
      written: RECORDED,
      removed: [],
      outcome: {
        outcome: "failed",
        error: {
          kind: "team-config-refused",
          refusal: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" },
        },
      },
    });
  });

  it("refuses naming the load failure's detail when version 1's project fails", async () => {
    const failure: LoadFailure = {
      kind: "git-failed",
      detail: "git ls-files: not a git repository",
    };
    const project = vi
      .fn<VersionOneProject>()
      .mockResolvedValue({ outcome: "failed", error: failure });
    const fileText = fileTextHolding({ configText: CONFIG_TEXT });
    await expect(
      versionOneProjectionsOfRepository(requestOver({ project, fileText }))(),
    ).resolves.toEqual({
      written: RECORDED,
      removed: [],
      outcome: {
        outcome: "failed",
        error: { kind: "project-failed", detail: "git-failed git ls-files: not a git repository" },
      },
    });
  });
});
