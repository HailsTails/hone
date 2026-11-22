import { describe, expect, it, type Mock, vi } from "vitest";
import type { DirectoryEntry, DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../node/path-port.ts";
import { recordsOnDiskOf } from "./version-one-records-on-disk.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";

const listing = (entries: readonly DirectoryEntry[]): ReturnType<DirectoryPort["list"]> => ({ outcome: "ok", value: entries });

const KIND_FOLDER: DirectoryEntry = { name: "file-carve-outs", kind: "directory" };

const EMPTIED_KIND_FOLDER: DirectoryEntry = { name: "authorised-locations", kind: "directory" };

const README: DirectoryEntry = { name: "README.md", kind: "file" };

const RECORDS_FILE: DirectoryEntry = { name: "cd-15.json", kind: "file" };

const SINGLE_FILE_PATH = { path: "/repo/discipline-exceptions.json" };

const RECORDS_FOLDER_PATH = { path: "/repo/discipline-exceptions" };

const read = (request: { readonly exists: Mock<FileTextPort["exists"]>; readonly list: Mock<DirectoryPort["list"]> }) =>
  recordsOnDiskOf({
    repoRoot: absoluteRootOf("/repo"),
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    fileText: { exists: request.exists },
    directory: { list: request.list },
  });

const nothingPresent = () => vi.fn<FileTextPort["exists"]>().mockReturnValue("absent");

const singleFilePresent = () => vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent");

const recordsFolderPresent = () => vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present");

describe("recordsOnDiskOf", () => {
  it("holds nothing for a repository with no records file and no records folder", () => {
    const exists = nothingPresent();
    const list = vi.fn<DirectoryPort["list"]>();
    expect({ read: read({ exists, list }), existsCalls: exists.mock.calls, listCalls: list.mock.calls }).toEqual({
      read: { outcome: "ok", value: { files: [], folders: [], root: { kind: "folder", folder: "discipline-exceptions" } } },
      existsCalls: [[SINGLE_FILE_PATH], [RECORDS_FOLDER_PATH]],
      listCalls: [],
    });
  });

  it("holds the single file at the repository root even when it lists no entries", () => {
    const exists = singleFilePresent();
    const list = vi.fn<DirectoryPort["list"]>();
    expect({ read: read({ exists, list }), existsCalls: exists.mock.calls, listCalls: list.mock.calls }).toEqual({
      read: { outcome: "ok", value: { files: ["discipline-exceptions.json"], folders: [], root: { kind: "repository" } } },
      existsCalls: [[SINGLE_FILE_PATH], [RECORDS_FOLDER_PATH]],
      listCalls: [],
    });
  });

  it("holds every json file under the records folder and every folder, an emptied kind folder and the records folder included, ignoring other files", () => {
    const exists = recordsFolderPresent();
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValueOnce(listing([KIND_FOLDER, EMPTIED_KIND_FOLDER, README]))
      .mockReturnValueOnce(listing([RECORDS_FILE]))
      .mockReturnValueOnce(listing([]));
    expect({ read: read({ exists, list }), existsCalls: exists.mock.calls, listCalls: list.mock.calls }).toEqual({
      read: {
        outcome: "ok",
        value: {
          files: ["discipline-exceptions/file-carve-outs/cd-15.json"],
          folders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs", "discipline-exceptions/authorised-locations"],
          root: { kind: "folder", folder: "discipline-exceptions" },
        },
      },
      existsCalls: [[SINGLE_FILE_PATH], [RECORDS_FOLDER_PATH]],
      listCalls: [[RECORDS_FOLDER_PATH], [{ path: "/repo/discipline-exceptions/file-carve-outs" }], [{ path: "/repo/discipline-exceptions/authorised-locations" }]],
    });
  });

  it("holds the records folder when every kind folder in it is empty and no file is", () => {
    const exists = recordsFolderPresent();
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValueOnce(listing([KIND_FOLDER])).mockReturnValueOnce(listing([]));
    expect({ read: read({ exists, list }), listCalls: list.mock.calls }).toEqual({
      read: {
        outcome: "ok",
        value: {
          files: [],
          folders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs"],
          root: { kind: "folder", folder: "discipline-exceptions" },
        },
      },
      listCalls: [[RECORDS_FOLDER_PATH], [{ path: "/repo/discipline-exceptions/file-carve-outs" }]],
    });
  });

  it("fails as an unreadable file when the records folder cannot be listed", () => {
    const exists = recordsFolderPresent();
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValue({ outcome: "failed", error: { kind: "directory-unreadable", path: absoluteRootOf("/repo/discipline-exceptions"), detail: "EACCES" } });
    expect({ read: read({ exists, list }), listCalls: list.mock.calls }).toEqual({
      read: { outcome: "failed", error: { kind: "file-unreadable", path: "/repo/discipline-exceptions", detail: "EACCES" } },
      listCalls: [[RECORDS_FOLDER_PATH]],
    });
  });
});
