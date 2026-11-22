import { describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { shippedCataloguesOf } from "./shipped-catalogues.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const UNLISTED: DirectoryPort = { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() };

describe("shippedCataloguesOf", () => {
  it("fails naming the catalogue's path when the install holds none", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: '{ "version": 1, "clauses": [], "recordKinds": {} }' }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(shippedCataloguesOf({ fileText, directory: UNLISTED, path: PATH, installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/install/rules", detail: "the install holds no symptom catalogue" },
    });
  });

  it("fails with the load failure when the install's rule items cannot be listed", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: '{ "version": 1, "clauses": [], "recordKinds": {} }' }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: absoluteRootOf("/install/rules"), detail: "EACCES" } }),
      create: vi.fn<DirectoryPort["create"]>(),
    };
    expect(shippedCataloguesOf({ fileText, directory, path: PATH, installRoot: INSTALL_ROOT })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/install/rules", detail: "EACCES" },
    });
  });

  it("fails with the load failure when the catalogue cannot be read", () => {
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/install/src/infrastructure/disciplines-file/version-one-names.json", detail: "EACCES" } }),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(shippedCataloguesOf({ fileText, directory: UNLISTED, path: PATH, installRoot: INSTALL_ROOT })).toMatchObject({ outcome: "failed", error: { kind: "file-unreadable" } });
  });
});
