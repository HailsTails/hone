import { assert, describe, expect, it, vi } from "vitest";
import type { TreeEntry } from "../../../application/ports/file-system/directory-tree-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { createDefaultDirectoryTreePort, createDirectoryTreePort, type DirectoryTreeSurface } from "./directory-tree-port.ts";
import { createDefaultDirectoryPort, createDefaultEntryKindPort, createDefaultFileTextPort } from "./file-system-port.ts";

const FOLDER = absolutePathSchema.parse("/repo/scratch");

describe("createDirectoryTreePort", () => {
  it("lists the tree under the path through the surface in path order without mutating what it returned", () => {
    const entries: readonly TreeEntry[] = Object.freeze([
      { path: "b/c.ts", name: "c.ts", kind: "file" },
      { path: "a.ts", name: "a.ts", kind: "file" },
      { path: "b", name: "b", kind: "directory" },
    ]);
    const list = vi.fn<DirectoryTreeSurface["list"]>().mockReturnValue(entries);

    expect(createDirectoryTreePort({ surface: { list, remove: vi.fn<DirectoryTreeSurface["remove"]>() } }).list({ path: FOLDER })).toEqual({
      outcome: "ok",
      value: [
        { path: "a.ts", name: "a.ts", kind: "file" },
        { path: "b", name: "b", kind: "directory" },
        { path: "b/c.ts", name: "c.ts", kind: "file" },
      ],
    });
    expect(list).toHaveBeenCalledExactlyOnceWith({ path: FOLDER });
  });

  it("reports a tree the surface cannot read as unreadable with its detail", () => {
    const list = vi.fn<DirectoryTreeSurface["list"]>().mockThrow(new Error("ENOENT: no such file or directory"));

    expect(createDirectoryTreePort({ surface: { list, remove: vi.fn<DirectoryTreeSurface["remove"]>() } }).list({ path: FOLDER })).toEqual({
      outcome: "failed",
      error: { kind: "directory-tree-unreadable", path: FOLDER, detail: "ENOENT: no such file or directory" },
    });
  });

  it("removes the tree at the path through the surface", () => {
    const remove = vi.fn<DirectoryTreeSurface["remove"]>();

    expect(createDirectoryTreePort({ surface: { list: vi.fn<DirectoryTreeSurface["list"]>(), remove } }).remove({ path: FOLDER })).toEqual({
      outcome: "ok",
      value: undefined,
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ path: FOLDER });
  });

  it("reports a removal the surface refuses as unremovable with its detail", () => {
    const remove = vi.fn<DirectoryTreeSurface["remove"]>().mockThrow(new Error("EPERM: operation not permitted"));

    expect(createDirectoryTreePort({ surface: { list: vi.fn<DirectoryTreeSurface["list"]>(), remove } }).remove({ path: FOLDER })).toEqual({
      outcome: "failed",
      error: { kind: "directory-tree-unremovable", path: FOLDER, detail: "EPERM: operation not permitted" },
    });
  });
});

describe("createDefaultDirectoryTreePort", () => {
  const SCRATCH = absolutePathSchema.parse(`${import.meta.dirname}/../../../../artefacts/directory-tree-port-${globalThis.crypto.randomUUID()}`);

  it("lists every file and folder under a folder by slash-separated path, then removes the whole tree", () => {
    const directory = createDefaultDirectoryPort({});
    const fileText = createDefaultFileTextPort({});
    const tree = createDefaultDirectoryTreePort({});
    assert(directory.create({ path: absolutePathSchema.parse(`${SCRATCH}/nested/deeper`) }).outcome === "ok", "the nested folders are made");
    assert(fileText.write({ path: `${SCRATCH}/top.txt`, text: "top" }).outcome === "ok", "the top file is written");
    assert(fileText.write({ path: `${SCRATCH}/nested/deeper/leaf.txt`, text: "leaf" }).outcome === "ok", "the leaf file is written");

    expect(tree.list({ path: SCRATCH })).toEqual({
      outcome: "ok",
      value: [
        { path: "nested", name: "nested", kind: "directory" },
        { path: "nested/deeper", name: "deeper", kind: "directory" },
        { path: "nested/deeper/leaf.txt", name: "leaf.txt", kind: "file" },
        { path: "top.txt", name: "top.txt", kind: "file" },
      ],
    });
    expect(tree.remove({ path: SCRATCH })).toEqual({ outcome: "ok", value: undefined });
    expect(createDefaultEntryKindPort({}).kindOf({ path: SCRATCH })).toBe("absent");
  });

  it("reports removing a tree that is not there as unremovable", () => {
    const outcome = createDefaultDirectoryTreePort({}).remove({ path: SCRATCH });

    expect(outcome).toMatchObject({ outcome: "failed", error: { kind: "directory-tree-unremovable", path: SCRATCH } });
  });
});
