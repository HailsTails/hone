import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import type { DirectoryTreePort } from "../../src/application/ports/file-system/directory-tree-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { listSourceFiles } from "./source-files.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("listSourceFiles", () => {
  it("lists each script file at the root and in its folders, reading no hidden, installed or built folder", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [
        { name: ".claude", kind: "directory" },
        { name: ".hidden.ts", kind: "file" },
        { name: "README.md", kind: "file" },
        { name: "artefacts", kind: "directory" },
        { name: "node_modules", kind: "directory" },
        { name: "src", kind: "directory" },
        { name: "vitest.config.ts", kind: "file" },
      ],
    });
    const listTree = vi.fn<DirectoryTreePort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [
        { path: ".cache/a.ts", name: "a.ts", kind: "file" },
        { path: "artefacts/a.ts", name: "a.ts", kind: "file" },
        { path: "engines", name: "engines", kind: "directory" },
        { path: "engines/node_modules/zod/index.js", name: "index.js", kind: "file" },
        { path: "engines/run.cjs", name: "run.cjs", kind: "file" },
        { path: "engines/run.json", name: "run.json", kind: "file" },
        { path: "engines/view.tsx", name: "view.tsx", kind: "file" },
      ],
    });

    const files = listSourceFiles({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: listTree },
      path: PATH,
    });

    expect(files).toEqual({
      outcome: "ok",
      value: [
        "src/artefacts/a.ts",
        "src/engines/run.cjs",
        "src/engines/view.tsx",
        "vitest.config.ts",
      ],
    });
    expect(list.mock.calls).toEqual([[{ path: "/repo" }]]);
    expect(listTree.mock.calls).toEqual([[{ path: "/repo/src" }]]);
  });

  it("leaves out the files hone project writes at the root, though not a file of that name in a folder", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [
        { name: "hone.eslint.d.mts", kind: "file" },
        { name: "hone.eslint.mjs", kind: "file" },
        { name: "src", kind: "directory" },
      ],
    });
    const listTree = vi.fn<DirectoryTreePort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [{ path: "hone.eslint.d.mts", name: "hone.eslint.d.mts", kind: "file" }],
    });

    const files = listSourceFiles({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: listTree },
      path: PATH,
    });

    expect(files).toEqual({ outcome: "ok", value: ["src/hone.eslint.d.mts"] });
  });

  it("fails naming a root it cannot list", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "directory-unreadable", path: absoluteRootOf("/repo"), detail: "EACCES" },
    });

    const files = listSourceFiles({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: vi.fn<DirectoryTreePort["list"]>() },
      path: PATH,
    });

    expect(files).toEqual({ outcome: "failed", error: "/repo: EACCES" });
  });

  it("fails naming a folder it cannot list", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [{ name: "src", kind: "directory" }],
    });
    const listTree = vi.fn<DirectoryTreePort["list"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "directory-tree-unreadable",
        path: absoluteRootOf("/repo/src"),
        detail: "EACCES",
      },
    });

    const files = listSourceFiles({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: listTree },
      path: PATH,
    });

    expect(files).toEqual({ outcome: "failed", error: "/repo/src: EACCES" });
  });

  it("fails naming a folder whose path resolves to nothing", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [{ name: "src", kind: "directory" }],
    });

    const files = listSourceFiles({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: vi.fn<DirectoryTreePort["list"]>() },
      path: {
        join: vi.fn<PathPort["join"]>().mockReturnValue("src"),
        resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({
          outcome: "failed",
          error: { kind: "working-directory-unusable", path: "src" },
        }),
      },
    });

    expect(files).toEqual({ outcome: "failed", error: "src: working-directory-unusable" });
  });
});
