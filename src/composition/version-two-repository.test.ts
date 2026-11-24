import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitTreePort } from "../application/ports/git-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { repoRootOf, repositoryLocatedOf, stagesOverRepository } from "./version-two-repository.ts";
import type { StagesOver } from "./version-two-stages.ts";

const memory: { readonly fileText: FileTextPort; readonly directory: DirectoryPort } = {
  fileText: {
    exists: () => "absent",
    read: ({ path }) => ({
      outcome: "failed",
      error: { kind: "unreadable", path, detail: "absent" },
    }),
    write: () => ({ outcome: "ok", value: undefined }),
  },
  directory: {
    list: () => ({ outcome: "ok", value: [] }),
    create: () => ({ outcome: "ok", value: undefined }),
  },
};

const emptyProcess: ProcessPort = {
  arguments: [],
  writeOut: () => undefined,
  writeError: () => undefined,
  exitWith: () => undefined,
};

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const MODULE_URL = "file:///install/src/hone.ts";

const UNRESOLVABLE_PATH: PathPort = {
  ...createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  resolve: ({ path }) => ({
    outcome: "failed",
    error: { kind: "working-directory-unusable", path },
  }),
};

describe("repoRootOf", () => {
  it("resolves --repo against the working directory", () => {
    expect(repoRootOf({ path: PATH, repo: "shop" })).toEqual({
      outcome: "ok",
      value: "/work/shop",
    });
  });

  it("is an arguments-invalid failure naming --repo when it resolves to no absolute path", () => {
    expect(repoRootOf({ path: UNRESOLVABLE_PATH, repo: "shop" })).toEqual({
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: "--repo shop resolves to no absolute path" },
    });
  });
});

describe("repositoryLocatedOf", () => {
  it("gives the repository root and the install the command runs from", () => {
    expect(repositoryLocatedOf({ path: PATH, moduleUrl: MODULE_URL, repo: "/repo" })).toEqual({
      outcome: "ok",
      value: { repoRoot: "/repo", installRoot: "/install" },
    });
  });

  it("fails as the install-root failure when the command was not started from a file", () => {
    expect(
      repositoryLocatedOf({
        path: PATH,
        moduleUrl: "https://example.com/tool-command.js",
        repo: "/repo",
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "install-root-unresolvable" },
    });
  });
});

const commandRequestWithSpies = (): VersionOneCommandRequest => ({
  git: {
    trackedPaths: vi.fn<VersionOneCommandRequest["git"]["trackedPaths"]>(),
    changedSince: vi.fn<VersionOneCommandRequest["git"]["changedSince"]>(),
    contentInBase: vi.fn<VersionOneCommandRequest["git"]["contentInBase"]>(),
    textInBase: vi.fn<VersionOneCommandRequest["git"]["textInBase"]>(),
    renamedSince: vi.fn<VersionOneCommandRequest["git"]["renamedSince"]>(),
  },
  process: emptyProcess,
  path: PATH,
  fileText: memory.fileText,
  modules: { load: vi.fn<VersionOneCommandRequest["modules"]["load"]>() },
  exceptionRepositoryOf: vi.fn<VersionOneCommandRequest["exceptionRepositoryOf"]>(),
  exceptionEntryParser: {
    parseExceptionEntries:
      vi.fn<VersionOneCommandRequest["exceptionEntryParser"]["parseExceptionEntries"]>(),
    importedEntriesIn:
      vi.fn<VersionOneCommandRequest["exceptionEntryParser"]["importedEntriesIn"]>(),
    importSourcesOf: vi.fn<VersionOneCommandRequest["exceptionEntryParser"]["importSourcesOf"]>(),
  },
  selectionRepositoryOf: vi.fn<VersionOneCommandRequest["selectionRepositoryOf"]>(),
  shownPathOfRepository: vi.fn<VersionOneCommandRequest["shownPathOfRepository"]>(),
  moduleUrl: MODULE_URL,
});

describe("stagesOverRepository", () => {
  it("builds the stages over the command's ports, the located repository and the base revision given", () => {
    const stages: VersionTwoStages = {
      catalogue: vi.fn<VersionTwoStages["catalogue"]>(),
      settings: vi.fn<VersionTwoStages["settings"]>(),
      records: vi.fn<VersionTwoStages["records"]>(),
      tree: vi.fn<VersionTwoStages["tree"]>(),
      engines: vi.fn<VersionTwoStages["engines"]>(),
      projections: vi.fn<VersionTwoStages["projections"]>(),
      renamed: vi
        .fn<VersionTwoStages["renamed"]>()
        .mockReturnValue({ measured: "yes", renamed: new Map() }),
      touched: vi.fn<VersionTwoStages["touched"]>(),
    };
    const stagesOver = vi.fn<StagesOver>().mockReturnValue(stages);
    const command = commandRequestWithSpies();
    const gitTree: GitTreePort = { pathsAt: () => ({ outcome: "ok", value: [] }) };
    const recordsSourceOf = vi.fn<RecordsSourceOf>();
    const built = stagesOverRepository({
      ports: {
        ...command,
        namedEngine: { load: vi.fn(), run: vi.fn(), project: vi.fn() },
        gitTree,
        directory: memory.directory,
        recordsSourceOf,
        stagesOver,
      },
      moduleUrl: MODULE_URL,
      located: { repoRoot: absoluteRootOf("/repo"), installRoot: absoluteRootOf("/install") },
      baseRevision: "origin/main",
    });
    expect(built).toBe(stages);
    expect(stagesOver).toHaveBeenCalledWith({
      ports: expect.objectContaining({
        gitTree,
        directory: memory.directory,
        recordsSourceOf,
        fileText: memory.fileText,
        git: command.git,
      }),
      locations: {
        repoRoot: "/repo",
        installRoot: "/install",
        moduleExtension: ".ts",
        baseRevision: "origin/main",
      },
    });
  });
});
