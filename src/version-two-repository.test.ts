import { describe, expect, it, vi } from "vitest";
import { commandOver, gitTreeStub, memoryRepositoryOf, recordedProcessWith } from "../tests/command-harness.ts";
import type { PathPort } from "./infrastructure/node/path-port.ts";
import type { RecordsSourceOf } from "./infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { absolutePathSchema } from "./infrastructure/content-files/absolute-path.ts";
import { createPathPort } from "./infrastructure/node/path-port.ts";
import { type StagesOver, repoRootOf, repositoryLocatedOf, stagesOverRepository } from "./version-two-repository.ts";
import type { VersionTwoStages } from "./application/run/version-two-run.ts";

const memory = memoryRepositoryOf({ files: {} });

const command = commandOver({ process: recordedProcessWith({ arguments: [] }).port, fileText: memory.fileText });

const UNRESOLVABLE_PATH: PathPort = {
  ...createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }),
};

describe("repoRootOf", () => {
  it("resolves --repo against the working directory", () => {
    expect(repoRootOf({ command, repo: "shop" })).toEqual({ outcome: "ok", value: "/work/shop" });
  });

  it("is an arguments-invalid failure naming --repo when it resolves to no absolute path", () => {
    expect(repoRootOf({ command: { ...command, path: UNRESOLVABLE_PATH }, repo: "shop" })).toEqual({
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: "--repo shop resolves to no absolute path" },
    });
  });
});

describe("repositoryLocatedOf", () => {
  it("gives the repository root and the install the command runs from", () => {
    expect(repositoryLocatedOf({ command, repo: "/repo" })).toEqual({ outcome: "ok", value: { repoRoot: "/repo", installRoot: "/install" } });
  });

  it("fails as the install-root failure when the command was not started from a file", () => {
    expect(repositoryLocatedOf({ command: { ...command, moduleUrl: "https://example.com/tool-command.js" }, repo: "/repo" })).toMatchObject({
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
    const gitTree = gitTreeStub();
    const recordsSourceOf = vi.fn<RecordsSourceOf>();
    const built = stagesOverRepository({
      ports: { gitTree, directory: memory.directory, recordsSourceOf, stagesOver },
      command,
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
