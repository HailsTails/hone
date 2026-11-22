import { describe, expect, it, vi } from "vitest";

import type { DirectoryEntry } from "../../../application/ports/file-system/directory-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import {
  createDirectoryPort,
  createEntryKindPort,
  type DirectorySurface,
  type EntryKindSurface,
} from "./file-system-port.ts";

const DIRECTORY = absoluteRootOf("D:\\work\\project files\\src");

describe("createDirectoryPort", () => {
  it("forwards the unchanged native path once and returns all entries in UTF16 name order without mutating input", () => {
    const entries: readonly DirectoryEntry[] = Object.freeze([
      { name: "\uE000", kind: "file" },
      { name: "é", kind: "directory" },
      { name: "a", kind: "file" },
      { name: "😀", kind: "file" },
      { name: "Z", kind: "directory" },
    ]);
    const list = vi.fn<DirectorySurface["list"]>().mockReturnValue(entries);

    const directoryOutcome = createDirectoryPort({
      directory: { list, create: vi.fn<DirectorySurface["create"]>() },
    }).list({ path: DIRECTORY });

    expect(directoryOutcome).toEqual({
      outcome: "ok",
      value: [
        { name: "Z", kind: "directory" },
        { name: "a", kind: "file" },
        { name: "é", kind: "directory" },
        { name: "😀", kind: "file" },
        { name: "\uE000", kind: "file" },
      ],
    });
    expect(directoryOutcome).not.toEqual({ outcome: "ok", value: entries });
    expect(entries).toEqual([
      { name: "\uE000", kind: "file" },
      { name: "é", kind: "directory" },
      { name: "a", kind: "file" },
      { name: "😀", kind: "file" },
      { name: "Z", kind: "directory" },
    ]);
    expect(list).toHaveBeenCalledExactlyOnceWith({ path: "D:\\work\\project files\\src" });
  });

  it("returns an observed empty directory as successful empty entries", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockReturnValue([]);

    expect(
      createDirectoryPort({
        directory: { list, create: vi.fn<DirectorySurface["create"]>() },
      }).list({ path: DIRECTORY }),
    ).toEqual({
      outcome: "ok",
      value: [],
    });
    expect(list).toHaveBeenCalledExactlyOnceWith({ path: DIRECTORY });
  });

  it("preserves an external Error message and the affected directory", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockThrow(new Error("directory access denied"));

    expect(
      createDirectoryPort({
        directory: { list, create: vi.fn<DirectorySurface["create"]>() },
      }).list({ path: DIRECTORY }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "directory-unreadable",
        path: DIRECTORY,
        detail: "directory access denied",
      },
    });
  });

  it("preserves a non-Error external failure as text with the affected directory", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockThrow("directory unavailable");

    expect(
      createDirectoryPort({
        directory: { list, create: vi.fn<DirectorySurface["create"]>() },
      }).list({ path: DIRECTORY }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "directory-unreadable",
        path: DIRECTORY,
        detail: "directory unavailable",
      },
    });
  });
});

describe("createDirectoryPort create", () => {
  it("creates the folder through the surface and reports success", () => {
    const create = vi.fn<DirectorySurface["create"]>();

    expect(
      createDirectoryPort({
        directory: { list: vi.fn<DirectorySurface["list"]>(), create },
      }).create({ path: DIRECTORY }),
    ).toEqual({
      outcome: "ok",
      value: undefined,
    });
    expect(create).toHaveBeenCalledExactlyOnceWith({ path: DIRECTORY });
  });

  it("reports a folder the surface cannot create with its path and the error message", () => {
    const create = vi
      .fn<DirectorySurface["create"]>()
      .mockThrow(new Error("read-only file system"));

    expect(
      createDirectoryPort({
        directory: { list: vi.fn<DirectorySurface["list"]>(), create },
      }).create({ path: DIRECTORY }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "directory-uncreatable", path: DIRECTORY, detail: "read-only file system" },
    });
  });
});

describe("createEntryKindPort", () => {
  it.each([
    { found: "file", kind: "file" },
    { found: "directory", kind: "directory" },
    { found: undefined, kind: "absent" },
  ] as const)("reports $kind for an entry the surface finds as $found", ({ found, kind }) => {
    const stat = vi.fn<EntryKindSurface["stat"]>().mockReturnValue(found);

    expect(createEntryKindPort({ surface: { stat } }).kindOf({ path: DIRECTORY })).toBe(kind);
    expect(stat).toHaveBeenCalledExactlyOnceWith({ path: DIRECTORY });
  });

  it("reports an entry the surface cannot inspect as absent, as TypeScript's own file checks do", () => {
    const stat = vi.fn<EntryKindSurface["stat"]>().mockThrow(new Error("permission denied"));

    expect(createEntryKindPort({ surface: { stat } }).kindOf({ path: DIRECTORY })).toBe("absent");
  });
});
