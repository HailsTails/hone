import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileRemovalPort } from "../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { createRecordsStore } from "./records-store.ts";

const REPO_ROOT = absoluteRootOf("/work/shop");

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const OTHER_FILE = repoPathOf("hone-records/debt/date-used-directly.json");

const OK = { outcome: "ok", value: undefined } as const;

const portsOf = () => {
  const write = vi.fn<FileTextPort["write"]>().mockReturnValue(OK);
  const remove = vi.fn<FileRemovalPort["remove"]>().mockReturnValue(OK);
  const create = vi.fn<DirectoryPort["create"]>().mockReturnValue(OK);
  const path = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });
  return {
    write,
    remove,
    create,
    ports: {
      fileText: { write },
      removal: { remove },
      directory: { create },
      path,
      repoRoot: REPO_ROOT,
    },
  };
};

describe("the store that writes and removes the files of hone-records", () => {
  it("writes each document's text to its file, in a folder it has made", () => {
    const { write, create, ports } = portsOf();
    const applied = createRecordsStore(ports).apply({
      edit: { write: [{ file: DEBT_FILE, document: { version: 2, records: [] } }], remove: [] },
    });
    expect(applied).toEqual(OK);
    expect(create).toHaveBeenCalledWith({ path: "/work/shop/hone-records/debt" });
    expect(write).toHaveBeenCalledWith({
      path: "/work/shop/hone-records/debt/claimed-type.json",
      text: '{\n  "version": 2,\n  "records": []\n}\n',
    });
  });

  it("removes each file it is told to remove", () => {
    const { remove, ports } = portsOf();
    const applied = createRecordsStore(ports).apply({
      edit: { write: [], remove: [DEBT_FILE, OTHER_FILE] },
    });
    expect(applied).toEqual(OK);
    expect(remove.mock.calls).toEqual([
      [{ path: "/work/shop/hone-records/debt/claimed-type.json" }],
      [{ path: "/work/shop/hone-records/debt/date-used-directly.json" }],
    ]);
  });

  it("stops at the first file it cannot write, and says which", () => {
    const { write, ports } = portsOf();
    write.mockReturnValue({
      outcome: "failed",
      error: {
        kind: "unwritable",
        path: "/work/shop/hone-records/debt/claimed-type.json",
        detail: "EACCES",
      },
    });
    const applied = createRecordsStore(ports).apply({
      edit: {
        write: [
          { file: DEBT_FILE, document: { version: 2, records: [] } },
          { file: OTHER_FILE, document: { version: 2, records: [] } },
        ],
        remove: [],
      },
    });
    expect(applied).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unwritable",
        path: "/work/shop/hone-records/debt/claimed-type.json",
        detail: "EACCES",
      },
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("says which folder it could not make", () => {
    const { create, ports } = portsOf();
    create.mockReturnValue({
      outcome: "failed",
      error: {
        kind: "directory-uncreatable",
        path: absoluteRootOf("/work/shop/hone-records/debt"),
        detail: "EROFS",
      },
    });
    expect(
      createRecordsStore(ports).apply({
        edit: { write: [{ file: DEBT_FILE, document: { version: 2, records: [] } }], remove: [] },
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/work/shop/hone-records/debt", detail: "EROFS" },
    });
  });

  it("says which file it could not remove", () => {
    const { remove, ports } = portsOf();
    remove.mockReturnValue({
      outcome: "failed",
      error: {
        kind: "unremovable",
        path: "/work/shop/hone-records/debt/claimed-type.json",
        detail: "EBUSY",
      },
    });
    expect(createRecordsStore(ports).apply({ edit: { write: [], remove: [DEBT_FILE] } })).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unwritable",
        path: "/work/shop/hone-records/debt/claimed-type.json",
        detail: "EBUSY",
      },
    });
  });
});
