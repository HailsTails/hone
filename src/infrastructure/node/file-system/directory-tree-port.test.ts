import { assert, describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../../application/ports/file-system/directory-removal-port.ts";
import type { FileRemovalPort } from "../../../application/ports/file-system/file-removal-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { createDefaultDirectoryTreePort, createDirectoryTreePort } from "./directory-tree-port.ts";
import { createDefaultDirectoryPort, createDefaultEntryKindPort, createDefaultFileTextPort } from "./file-system-port.ts";

const FOLDER = absolutePathSchema.parse("/repo/scratch");

const NESTED = absolutePathSchema.parse("/repo/scratch/nested");

const OK_REMOVAL = { outcome: "ok", value: undefined } as const;

const directoryHolding = (request: { readonly listings: readonly ReturnType<DirectoryPort["list"]>[] }): DirectoryPort => {
  const list = vi.fn<DirectoryPort["list"]>();
  request.listings.forEach((listing) => {
    list.mockReturnValueOnce(listing);
  });
  return { list, create: vi.fn<DirectoryPort["create"]>() };
};

const TOP_AND_NESTED = [
  { outcome: "ok", value: [{ name: "top.txt", kind: "file" }, { name: "nested", kind: "directory" }] },
  { outcome: "ok", value: [{ name: "leaf.txt", kind: "file" }] },
] as const;

describe("createDirectoryTreePort", () => {
  it("lists every entry under the folder by slash-separated path in path order", () => {
    const tree = createDirectoryTreePort({
      directory: directoryHolding({ listings: TOP_AND_NESTED }),
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
      directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
    });

    expect(tree.list({ path: FOLDER })).toEqual({
      outcome: "ok",
      value: [
        { path: "nested", name: "nested", kind: "directory" },
        { path: "nested/leaf.txt", name: "leaf.txt", kind: "file" },
        { path: "top.txt", name: "top.txt", kind: "file" },
      ],
    });
  });

  it("reports a folder the directory port cannot read as unreadable with its detail", () => {
    const tree = createDirectoryTreePort({
      directory: directoryHolding({ listings: [{ outcome: "failed", error: { kind: "directory-unreadable", path: FOLDER, detail: "ENOENT" } }] }),
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
      directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
    });

    expect(tree.list({ path: FOLDER })).toEqual({ outcome: "failed", error: { kind: "directory-tree-unreadable", path: FOLDER, detail: "ENOENT" } });
  });

  it("removes each entry in listing order, each folder emptied before it is removed", () => {
    const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue(OK_REMOVAL);
    const removeEmpty = vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(OK_REMOVAL);
    const tree = createDirectoryTreePort({
      directory: directoryHolding({ listings: TOP_AND_NESTED }),
      fileRemoval: { remove },
      directoryRemoval: { removeEmpty },
    });

    expect(tree.remove({ path: FOLDER })).toEqual(OK_REMOVAL);
    expect(remove.mock.calls).toEqual([[{ path: "/repo/scratch/top.txt" }], [{ path: "/repo/scratch/nested/leaf.txt" }]]);
    expect(removeEmpty.mock.calls).toEqual([[{ path: NESTED }], [{ path: FOLDER }]]);
  });

  it("reports a file it cannot remove as unremovable with its detail, removing no folder", () => {
    const remove = vi
      .fn<FileRemovalPort["remove"]>()
      .mockReturnValue({ outcome: "failed", error: { kind: "unremovable", path: "/repo/scratch/top.txt", detail: "EPERM" } });
    const removeEmpty = vi.fn<DirectoryRemovalPort["removeEmpty"]>();
    const tree = createDirectoryTreePort({
      directory: directoryHolding({ listings: [{ outcome: "ok", value: [{ name: "top.txt", kind: "file" }] }] }),
      fileRemoval: { remove },
      directoryRemoval: { removeEmpty },
    });

    expect(tree.remove({ path: FOLDER })).toEqual({
      outcome: "failed",
      error: { kind: "directory-tree-unremovable", path: "/repo/scratch/top.txt", detail: "EPERM" },
    });
    expect(removeEmpty).not.toHaveBeenCalled();
  });

  it("reports a folder it cannot remove as unremovable with its detail", () => {
    const removeEmpty = vi
      .fn<DirectoryRemovalPort["removeEmpty"]>()
      .mockReturnValue({ outcome: "failed", error: { kind: "directory-unremovable", path: FOLDER, detail: "ENOTEMPTY" } });
    const tree = createDirectoryTreePort({
      directory: directoryHolding({ listings: [{ outcome: "ok", value: [] }] }),
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
      directoryRemoval: { removeEmpty },
    });

    expect(tree.remove({ path: FOLDER })).toEqual({
      outcome: "failed",
      error: { kind: "directory-tree-unremovable", path: FOLDER, detail: "ENOTEMPTY" },
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
    expect(tree.remove({ path: SCRATCH })).toEqual(OK_REMOVAL);
    expect(createDefaultEntryKindPort({}).kindOf({ path: SCRATCH })).toBe("absent");
  });
});
