import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import type { DirectoryTreePort } from "../../src/application/ports/file-system/directory-tree-port.ts";
import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import type { ReadModuleImports } from "./module-imports.ts";
import { readSourceImports } from "./source-imports.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("readSourceImports", () => {
  it("reads the imports of each source file, a file with none included", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [
        { name: "a.ts", kind: "file" },
        { name: "b.ts", kind: "file" },
      ],
    });
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: "first text" })
      .mockReturnValueOnce({ outcome: "ok", value: "second text" });
    const readModuleImports = vi
      .fn<ReadModuleImports>()
      .mockReturnValueOnce([{ specifier: "zod", kind: "import", form: "value", names: ["z"] }])
      .mockReturnValueOnce([]);

    const sources = readSourceImports({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: vi.fn<DirectoryTreePort["list"]>() },
      fileText: { read },
      path: PATH,
      readModuleImports,
    });

    expect(sources).toEqual({
      outcome: "ok",
      value: [
        {
          file: "a.ts",
          imports: [{ specifier: "zod", kind: "import", form: "value", names: ["z"] }],
        },
        { file: "b.ts", imports: [] },
      ],
    });
    expect(read.mock.calls).toEqual([[{ path: "/repo/a.ts" }], [{ path: "/repo/b.ts" }]]);
    expect(readModuleImports.mock.calls).toEqual([
      [{ file: "a.ts", text: "first text" }],
      [{ file: "b.ts", text: "second text" }],
    ]);
  });

  it("fails naming a file it cannot read", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "ok",
      value: [{ name: "a.ts", kind: "file" }],
    });
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unreadable", path: "/repo/a.ts", detail: "EACCES" },
    });

    const sources = readSourceImports({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: vi.fn<DirectoryTreePort["list"]>() },
      fileText: { read },
      path: PATH,
      readModuleImports: vi.fn<ReadModuleImports>(),
    });

    expect(sources).toEqual({ outcome: "failed", error: "a.ts: EACCES" });
  });

  it("fails when the source files cannot be listed", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "directory-unreadable", path: absoluteRootOf("/repo"), detail: "EACCES" },
    });

    const sources = readSourceImports({
      repoRoot: absoluteRootOf("/repo"),
      directory: { list },
      directoryTree: { list: vi.fn<DirectoryTreePort["list"]>() },
      fileText: { read: vi.fn<FileTextPort["read"]>() },
      path: PATH,
      readModuleImports: vi.fn<ReadModuleImports>(),
    });

    expect(sources).toEqual({ outcome: "failed", error: "/repo: EACCES" });
  });
});
