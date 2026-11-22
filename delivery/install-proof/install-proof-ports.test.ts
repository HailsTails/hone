import { describe, expect, it, vi } from "vitest";

import type { DirectoryTreePort } from "../../src/application/ports/file-system/directory-tree-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import {
  createDefaultDirectoryPort,
  createDefaultEntryKindPort,
  createDefaultFileTextPort,
} from "../../src/infrastructure/node/file-system/file-system-port.ts";
import type { EntryDisposition, StepRun } from "./install-proof-plan.ts";
import {
  type CommandSpawn,
  type CopiedEntry,
  createCommandRunPort,
  createDefaultScratchFilesPort,
  createScratchFilesPort,
  type ScratchFilesSurface,
} from "./install-proof-ports.ts";

const PERMISSION_DENIED = new Error("EACCES: permission denied, rm '/scratch/proof'");

const EXITED_CLEAN: StepRun = { outcome: "exited", exitCode: 0, output: "" };

const AMBIENT_ENVIRONMENT = {
  GIT_DIR: "/elsewhere/.git",
  GIT_INDEX_FILE: "/elsewhere/.git/index",
  PATH: "/usr/bin",
  HOME: "/home/someone",
};

const surfaceOver = (surface: Partial<ScratchFilesSurface>): ScratchFilesSurface => ({
  makeTemporaryDirectory: vi.fn(),
  makeDirectory: vi.fn(),
  copyTree: vi.fn(),
  digestOf: vi.fn(),
  realPathOf: vi.fn(),
  ...surface,
});

const treeOver = (tree: Partial<DirectoryTreePort>): DirectoryTreePort => ({
  list: vi.fn<DirectoryTreePort["list"]>(),
  remove: vi.fn<DirectoryTreePort["remove"]>(),
  ...tree,
});

const keepEverything = (_entry: CopiedEntry): EntryDisposition => "kept";

const commandsOver = (request: { readonly spawn: CommandSpawn; readonly platform: string }) =>
  createCommandRunPort({
    spawn: request.spawn,
    platform: request.platform,
    executablePath: "/opt/node/bin/node",
    ambientEnvironment: AMBIENT_ENVIRONMENT,
  });

describe("createScratchFilesPort createTemporaryDirectory", () => {
  it("returns the directory the surface made, for the requested prefix", () => {
    const makeTemporaryDirectory = vi
      .fn<ScratchFilesSurface["makeTemporaryDirectory"]>()
      .mockReturnValue("/scratch/proof-1");

    const created = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({ makeTemporaryDirectory }),
    }).createTemporaryDirectory({
      prefix: "proof-",
    });

    expect({ created, calls: makeTemporaryDirectory.mock.calls }).toEqual({
      created: { outcome: "ok", value: "/scratch/proof-1" },
      calls: [[{ prefix: "proof-" }]],
    });
  });

  it("returns effect-failed with the thrown message when the surface throws", () => {
    const created = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({
        makeTemporaryDirectory: vi
          .fn<ScratchFilesSurface["makeTemporaryDirectory"]>()
          .mockThrow(PERMISSION_DENIED),
      }),
    }).createTemporaryDirectory({ prefix: "proof-" });

    expect(created).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createScratchFilesPort makeDirectory", () => {
  it("makes the requested directory", () => {
    const makeDirectory = vi.fn<ScratchFilesSurface["makeDirectory"]>();

    const made = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({ makeDirectory }),
    }).makeDirectory({ path: "/scratch/toolchain" });

    expect({ made, calls: makeDirectory.mock.calls }).toEqual({
      made: { outcome: "ok", value: null },
      calls: [[{ path: "/scratch/toolchain" }]],
    });
  });

  it("returns effect-failed when making the directory throws", () => {
    const made = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({
        makeDirectory: vi.fn<ScratchFilesSurface["makeDirectory"]>().mockThrow(PERMISSION_DENIED),
      }),
    }).makeDirectory({ path: "/scratch/toolchain" });

    expect(made).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

const SCRATCH_PROOF = absoluteRootOf("/scratch/proof");

describe("createScratchFilesPort removeTree", () => {
  it("removes the requested tree through the directory tree port", () => {
    const remove = vi
      .fn<DirectoryTreePort["remove"]>()
      .mockReturnValue({ outcome: "ok", value: undefined });

    const removed = createScratchFilesPort({
      surface: surfaceOver({}),
      tree: treeOver({ remove }),
    }).removeTree({ path: "/scratch/proof" });

    expect({ removed, calls: remove.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      calls: [[{ path: "/scratch/proof" }]],
    });
  });

  it("returns effect-failed with the tree port's detail when removing fails", () => {
    const remove = vi.fn<DirectoryTreePort["remove"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "directory-tree-unremovable",
        path: SCRATCH_PROOF,
        detail: "EACCES: permission denied",
      },
    });

    expect(
      createScratchFilesPort({ surface: surfaceOver({}), tree: treeOver({ remove }) }).removeTree({
        path: "/scratch/proof",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied" },
    });
  });
});

describe("createScratchFilesPort copyTree", () => {
  it("copies from and to the requested paths with the given disposition", () => {
    const copyTree = vi.fn<ScratchFilesSurface["copyTree"]>();

    const copied = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({ copyTree }),
    }).copyTree({
      from: "/package/core",
      to: "/repo/tools/hone/core",
      disposition: keepEverything,
    });

    expect({ copied, calls: copyTree.mock.calls }).toEqual({
      copied: { outcome: "ok", value: null },
      calls: [
        [{ from: "/package/core", to: "/repo/tools/hone/core", disposition: keepEverything }],
      ],
    });
  });

  it("returns effect-failed when copying throws", () => {
    const copied = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({
        copyTree: vi.fn<ScratchFilesSurface["copyTree"]>().mockThrow(PERMISSION_DENIED),
      }),
    }).copyTree({
      from: "/package/core",
      to: "/repo/tools/hone/core",
      disposition: keepEverything,
    });

    expect(copied).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createScratchFilesPort listTree", () => {
  it("returns the entries the directory tree port listed, folders named as folders", () => {
    const list = vi.fn<DirectoryTreePort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [
        { path: "core", name: "core", kind: "directory" },
        { path: "core/a.ts", name: "a.ts", kind: "file" },
      ],
    });

    const listed = createScratchFilesPort({
      surface: surfaceOver({}),
      tree: treeOver({ list }),
    }).listTree({ path: "/repo/tools/hone" });

    expect({ listed, calls: list.mock.calls }).toEqual({
      listed: {
        outcome: "ok",
        value: [
          { path: "core", name: "core", entryKind: "folder" },
          { path: "core/a.ts", name: "a.ts", entryKind: "file" },
        ],
      },
      calls: [[{ path: "/repo/tools/hone" }]],
    });
  });

  it("returns effect-failed with the tree port's detail when listing fails", () => {
    const list = vi.fn<DirectoryTreePort["list"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "directory-tree-unreadable", path: SCRATCH_PROOF, detail: "ENOENT" },
    });

    expect(
      createScratchFilesPort({ surface: surfaceOver({}), tree: treeOver({ list }) }).listTree({
        path: "/repo/tools/hone",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "ENOENT" },
    });
  });
});

describe("createScratchFilesPort given a path that is not absolute", () => {
  it("returns effect-failed from removeTree and from listTree, reaching the tree port with neither", () => {
    const tree = treeOver({});
    const scratch = createScratchFilesPort({ surface: surfaceOver({}), tree });

    expect({
      removed: scratch.removeTree({ path: "relative/proof" }),
      listed: scratch.listTree({ path: "relative/proof" }),
    }).toEqual({
      removed: {
        outcome: "failed",
        error: { kind: "effect-failed", detail: "relative/proof is not an absolute path" },
      },
      listed: {
        outcome: "failed",
        error: { kind: "effect-failed", detail: "relative/proof is not an absolute path" },
      },
    });
    expect(tree.remove).not.toHaveBeenCalled();
    expect(tree.list).not.toHaveBeenCalled();
  });
});

describe("createScratchFilesPort realPathOf", () => {
  it("returns the real path the surface resolved for the requested path", () => {
    const realPathOf = vi.fn<ScratchFilesSurface["realPathOf"]>().mockReturnValue("/store/zod");

    const resolved = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({ realPathOf }),
    }).realPathOf({ path: "/repo/node_modules/zod" });

    expect({ resolved, calls: realPathOf.mock.calls }).toEqual({
      resolved: { outcome: "ok", value: "/store/zod" },
      calls: [[{ path: "/repo/node_modules/zod" }]],
    });
  });

  it("returns effect-failed when the path cannot be resolved", () => {
    const resolved = createScratchFilesPort({
      tree: treeOver({}),
      surface: surfaceOver({
        realPathOf: vi.fn<ScratchFilesSurface["realPathOf"]>().mockThrow(PERMISSION_DENIED),
      }),
    }).realPathOf({ path: "/repo/node_modules/zod" });

    expect(resolved).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createCommandRunPort run", () => {
  it("runs git by name, directly, in the requested directory, with the ambient environment less every GIT_ variable", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "linux" }).run({
      command: "git",
      arguments: ["init", "-q"],
      directory: "/repo",
    });

    expect(spawn.mock.calls).toEqual([
      [
        {
          file: "git",
          arguments: ["init", "-q"],
          directory: "/repo",
          environment: { PATH: "/usr/bin", HOME: "/home/someone" },
          launch: "direct",
        },
      ],
    ]);
  });

  it("runs node as the injected executable path", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "linux" }).run({
      command: "node",
      arguments: ["entry.ts"],
      directory: "/repo",
    });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ file: "/opt/node/bin/node", launch: "direct" }),
    );
  });

  it.each(["npm", "pnpm"] as const)("runs %s directly off Windows", (command) => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "linux" }).run({
      command,
      arguments: ["install"],
      directory: "/root",
    });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ file: command, launch: "direct" }),
    );
  });

  it.each(["npm", "pnpm"] as const)("runs %s through a shell on Windows", (command) => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "win32" }).run({
      command,
      arguments: ["install"],
      directory: "C:\\root",
    });

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ file: command, launch: "shell" }));
  });

  it("runs git directly on Windows", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "win32" }).run({
      command: "git",
      arguments: ["init"],
      directory: "C:\\repo",
    });

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ file: "git", launch: "direct" }));
  });

  it("returns the run the spawn reported", () => {
    const run = commandsOver({
      spawn: vi
        .fn<CommandSpawn>()
        .mockReturnValue({ outcome: "not-exited", detail: "spawnSync npm ENOENT" }),
      platform: "linux",
    }).run({ command: "npm", arguments: ["install"], directory: "/root" });

    expect(run).toEqual({ outcome: "not-exited", detail: "spawnSync npm ENOENT" });
  });
});

describe("createDefaultScratchFilesPort lists and removes a tree through the directory tree port", () => {
  const SCRATCH = absolutePathSchema.parse(
    `${import.meta.dirname}/../../artefacts/install-proof-ports-${globalThis.crypto.randomUUID()}`,
  );

  it("lists each entry of a tree by slash-separated path and kind, then removes the whole tree", () => {
    const scratch = createDefaultScratchFilesPort({});
    createDefaultDirectoryPort({}).create({ path: absolutePathSchema.parse(`${SCRATCH}/folder`) });
    createDefaultFileTextPort({}).write({ path: `${SCRATCH}/folder/file.txt`, text: "text" });

    expect(scratch.listTree({ path: SCRATCH })).toEqual({
      outcome: "ok",
      value: [
        { path: "folder", name: "folder", entryKind: "folder" },
        { path: "folder/file.txt", name: "file.txt", entryKind: "file" },
      ],
    });
    expect(scratch.removeTree({ path: SCRATCH })).toEqual({ outcome: "ok", value: null });
    expect(createDefaultEntryKindPort({}).kindOf({ path: SCRATCH })).toBe("absent");
  });

  it("reports listing a tree that is not there as a failure", () => {
    expect(createDefaultScratchFilesPort({}).listTree({ path: SCRATCH })).toMatchObject({
      outcome: "failed",
    });
  });
});
