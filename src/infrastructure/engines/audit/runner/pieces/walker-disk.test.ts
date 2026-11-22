import { describe, expect, it, vi } from "vitest";
import type { EntryKindPort } from "../../../../../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { portsDisk, textsDisk } from "./walker-disk.ts";

const TEXTS_DISK = textsDisk({ root: "/repository", texts: { "packages/a/tsconfig.json": "{}", "tsconfig.base.json": "{ }" } });

describe("textsDisk", () => {
  it.each([
    { path: "/repository/packages/a/tsconfig.json", kind: "file" },
    { path: "/repository/tsconfig.base.json", kind: "file" },
    { path: "/repository/packages/a", kind: "directory" },
    { path: "/repository/packages", kind: "directory" },
    { path: "/repository", kind: "directory" },
    { path: "/repository/packages/b", kind: "absent" },
    { path: "/repository/packages/a/tsconfig", kind: "absent" },
    { path: "/elsewhere/tsconfig.base.json", kind: "absent" },
  ])("reports $path as $kind", ({ path, kind }) => {
    expect(TEXTS_DISK.kindAt({ path })).toBe(kind);
  });

  it("reads the text it holds at its path under the root", () => {
    expect(TEXTS_DISK.textAt({ path: "/repository/tsconfig.base.json" })).toEqual({ outcome: "ok", value: "{ }" });
  });

  it("reports a path it does not hold as unreadable", () => {
    expect(TEXTS_DISK.textAt({ path: "/repository/packages/a" })).toEqual({
      outcome: "failed",
      error: { detail: "/repository/packages/a is not a file" },
    });
  });

  it("names its root", () => {
    expect(TEXTS_DISK.root).toBe("/repository");
  });
});

describe("portsDisk", () => {
  it("asks the entry kind port for an entry's kind at the path given", () => {
    const entryKind: EntryKindPort = { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValue("directory") };
    const fileText: FileTextPort = { read: vi.fn(), exists: vi.fn(), write: vi.fn() };

    expect(portsDisk({ root: "/repo", entryKind, fileText }).kindAt({ path: "/repo/node_modules/@tsconfig/strictest" })).toBe("directory");
    expect(entryKind.kindOf).toHaveBeenCalledExactlyOnceWith({ path: "/repo/node_modules/@tsconfig/strictest" });
  });

  it("reads a file's text through the file text port", () => {
    const entryKind: EntryKindPort = { kindOf: vi.fn() };
    const fileText: FileTextPort = { read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{}" }), exists: vi.fn(), write: vi.fn() };

    expect(portsDisk({ root: "/repo", entryKind, fileText }).textAt({ path: "/repo/tsconfig.base.json" })).toEqual({ outcome: "ok", value: "{}" });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/tsconfig.base.json" });
  });

  it("reports a file the port cannot read with the port's detail", () => {
    const entryKind: EntryKindPort = { kindOf: vi.fn() };
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/x.json", detail: "EACCES" } }),
      exists: vi.fn(),
      write: vi.fn(),
    };

    expect(portsDisk({ root: "/repo", entryKind, fileText }).textAt({ path: "/repo/x.json" })).toEqual({ outcome: "failed", error: { detail: "EACCES" } });
  });

  it("names the repository root as its root", () => {
    expect(portsDisk({ root: "/repo", entryKind: { kindOf: vi.fn() }, fileText: { read: vi.fn(), exists: vi.fn(), write: vi.fn() } }).root).toBe("/repo");
  });
});
