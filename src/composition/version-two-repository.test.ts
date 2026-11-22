import { describe, expect, it, vi } from "vitest";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import type { GitTreePort } from "../application/ports/git-port.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import { absolutePathSchema } from "../infrastructure/content-files/absolute-path.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { repoRootOf, repositoryLocatedOf, stagesOverRepository } from "./version-two-repository.ts";
import type { StagesOver } from "./version-two-stages.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

const memory: { readonly fileText: FileTextPort; readonly directory: DirectoryPort } = {
  fileText: {
    exists: () => "absent",
    read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } }),
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

const command: VersionOneCommandRequest = {
  process: emptyProcess,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: memory.fileText,
  engine: createDefaultEnginePort({}),
  modules: { load: notUsed },
  git: { trackedPaths: notUsed, changedSince: notUsed, contentInBase: notUsed, textInBase: notUsed, renamedSince: notUsed },
  exceptionRepositoryOf: notUsed,
  exceptionEntryParser: { parseExceptionEntries: notUsed, importedEntriesIn: notUsed, importSourcesOf: notUsed },
  selectionRepositoryOf: notUsed,
  shownPathOfRepository: notUsed,
  moduleUrl: "file:///install/src/hone.ts",
};

const UNRESOLVABLE_PATH: PathPort = {
  ...createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }),
};

describe("repoRootOf", () => {
  it("resolves --repo against the working directory", () => {
    expect(repoRootOf({ path: command.path, repo: "shop" })).toEqual({ outcome: "ok", value: "/work/shop" });
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
    expect(repositoryLocatedOf({ path: command.path, moduleUrl: command.moduleUrl, repo: "/repo" })).toEqual({ outcome: "ok", value: { repoRoot: "/repo", installRoot: "/install" } });
  });

  it("fails as the install-root failure when the command was not started from a file", () => {
    expect(repositoryLocatedOf({ path: command.path, moduleUrl: "https://example.com/tool-command.js", repo: "/repo" })).toMatchObject({
      outcome: "failed",
      error: { kind: "install-root-unresolvable" },
    });
  });
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
      touched: vi.fn<VersionTwoStages["touched"]>(),
    };
    const stagesOver = vi.fn<StagesOver>().mockReturnValue(stages);
    const gitTree: GitTreePort = { pathsAt: () => ({ outcome: "ok", value: [] }) };
    const recordsSourceOf = vi.fn<RecordsSourceOf>();
    const built = stagesOverRepository({
      ports: { ...command, gitTree, directory: memory.directory, recordsSourceOf, stagesOver },
      moduleUrl: command.moduleUrl,
      located: { repoRoot: absolutePathSchema.parse("/repo"), installRoot: absolutePathSchema.parse("/install") },
      baseRevision: "origin/main",
    });
    expect(built).toBe(stages);
    expect(stagesOver).toHaveBeenCalledWith({
      ports: expect.objectContaining({ gitTree, directory: memory.directory, recordsSourceOf, fileText: memory.fileText, git: command.git }),
      locations: { repoRoot: "/repo", installRoot: "/install", moduleExtension: ".ts", baseRevision: "origin/main" },
    });
  });
});
