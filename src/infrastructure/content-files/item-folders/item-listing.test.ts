import { describe, expect, it, vi } from "vitest";
import type { DirectoryEntry } from "../../../application/ports/file-system/directory-port.ts";
import { createDirectoryPort, type DirectorySurface } from "../../node/file-system/file-system-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { filesUnder } from "./item-listing.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const ROOT = absoluteRootOf("/content");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => ROOT });

const ROOT_ENTRIES: readonly DirectoryEntry[] = [
  { name: "principles", kind: "directory" },
  { name: "a-b", kind: "directory" },
  { name: "a", kind: "directory" },
  { name: "notes.txt", kind: "file" },
];

describe("filesUnder", () => {
  it("gives every file under the root, from nested folders too, as a relative path in code point order", () => {
    const list = vi
      .fn<DirectorySurface["list"]>()
      .mockReturnValueOnce(ROOT_ENTRIES)
      .mockReturnValueOnce([{ name: "b.md", kind: "file" }])
      .mockReturnValueOnce([{ name: "c.md", kind: "file" }])
      .mockReturnValueOnce([{ name: "tests-are-ours.md", kind: "file" }]);
    const directory = createDirectoryPort({ directory: { list, create: vi.fn<DirectorySurface["create"]>() } });
    expect(filesUnder({ directory, path: PATH, root: ROOT })).toEqual({
      outcome: "ok",
      value: ["a-b/c.md", "a/b.md", "notes.txt", "principles/tests-are-ours.md"],
    });
  });

  it("gives nothing for a root that holds no files", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockReturnValueOnce([]);
    const directory = createDirectoryPort({ directory: { list, create: vi.fn<DirectorySurface["create"]>() } });
    expect(filesUnder({ directory, path: PATH, root: ROOT })).toEqual({ outcome: "ok", value: [] });
  });

  it("fails with the folder it could not list", () => {
    const list = vi
      .fn<DirectorySurface["list"]>()
      .mockReturnValueOnce([{ name: "gone", kind: "directory" }])
      .mockThrow(new Error("ENOENT: /content/gone"));
    const directory = createDirectoryPort({ directory: { list, create: vi.fn<DirectorySurface["create"]>() } });
    expect(filesUnder({ directory, path: PATH, root: ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "directory-unreadable", path: "/content/gone", detail: "ENOENT: /content/gone" },
    });
  });
});
