import { describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../../../application/ports/git-port.ts";
import { createRecordsFolder } from "./records-folder.ts";
import type { RecordsFolderPorts } from "../../../application/ports/records/records-source-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";


const REPO = absoluteRootOf("/repo");

const DEBT_TEXT = '{ "version": 2, "records": [{ "answers": "claimed-type", "file": "src/a.ts" }] }';

const BOUNDARIES_TEXT = '{ "version": 2, "records": [] }';

const portsWith = (request: {
  readonly exists: FileTextPort["exists"];
  readonly read: FileTextPort["read"];
  readonly list: DirectoryPort["list"];
  readonly pathsAt: GitTreePort["pathsAt"];
  readonly textInBase: GitPort["textInBase"];
}): RecordsFolderPorts => ({
  fileText: { exists: request.exists, read: request.read },
  directory: { list: request.list },
  git: { textInBase: request.textInBase },
  gitTree: { pathsAt: request.pathsAt },
});

const UNUSED_BASE = { pathsAt: vi.fn<GitTreePort["pathsAt"]>(), textInBase: vi.fn<GitPort["textInBase"]>() };

describe("createRecordsFolder, read", () => {
  it("reads no documents when the repository has no records folder", () => {
    const folder = createRecordsFolder({
      ...portsWith({ exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"), read: vi.fn<FileTextPort["read"]>(), list: vi.fn<DirectoryPort["list"]>(), ...UNUSED_BASE }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "ok", value: [] });
  });

  it("reads each records file under its repository path, in path order, as the JSON it holds", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: BOUNDARIES_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: DEBT_TEXT });
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "debt", kind: "directory" }, { name: "boundary-records.json", kind: "file" }] })
      .mockReturnValueOnce({ outcome: "ok", value: [{ name: "claimed-type.json", kind: "file" }] });
    const folder = createRecordsFolder({ ...portsWith({ exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"), read, list, ...UNUSED_BASE }), repoRoot: REPO });
    expect({ read: folder.read(), listed: list.mock.calls, readFrom: read.mock.calls }).toEqual({
      read: {
        outcome: "ok",
        value: [
          { file: "hone-records/boundary-records.json", document: { version: 2, records: [] } },
          { file: "hone-records/debt/claimed-type.json", document: { version: 2, records: [{ answers: "claimed-type", file: "src/a.ts" }] } },
        ],
      },
      listed: [[{ path: "/repo/hone-records" }], [{ path: "/repo/hone-records/debt" }]],
      readFrom: [[{ path: "/repo/hone-records/boundary-records.json" }], [{ path: "/repo/hone-records/debt/claimed-type.json" }]],
    });
  });

  it("fails naming a file in the records folder that is not a records file", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>(),
        list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [{ name: "notes.md", kind: "file" }] }),
        ...UNUSED_BASE,
      }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "failed", error: { kind: "not-a-records-file", file: "hone-records/notes.md" } });
  });

  it("fails naming a folder inside a kind folder, which holds only records files", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>(),
        list: vi
          .fn<DirectoryPort["list"]>()
          .mockReturnValueOnce({ outcome: "ok", value: [{ name: "debt", kind: "directory" }] })
          .mockReturnValueOnce({ outcome: "ok", value: [{ name: "team", kind: "directory" }] }),
        ...UNUSED_BASE,
      }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "failed", error: { kind: "not-a-records-file", file: "hone-records/debt/team" } });
  });

  it("fails naming an entry on disk whose name is no repository path, without throwing", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>(),
        list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [{ name: "..", kind: "file" }] }),
        ...UNUSED_BASE,
      }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "failed", error: { kind: "not-a-records-name", folder: "hone-records", name: ".." } });
  });

  it("fails naming a folder it cannot list", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>(),
        list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: absoluteRootOf("/repo/hone-records"), detail: "EACCES" } }),
        ...UNUSED_BASE,
      }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "failed", error: { kind: "records-folder-unreadable", folder: "hone-records", detail: "EACCES" } });
  });

  it("fails naming a records file it cannot read", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "failed", error: { kind: "unreadable", path: "/repo/hone-records/dependency-records.json", detail: "EACCES" } }),
        list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [{ name: "dependency-records.json", kind: "file" }] }),
        ...UNUSED_BASE,
      }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "failed", error: { kind: "records-file-unreadable", file: "hone-records/dependency-records.json", detail: "EACCES" } });
  });

  it("fails naming a records file that is not JSON", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "{ version: 2" }),
        list: vi.fn<DirectoryPort["list"]>().mockReturnValueOnce({ outcome: "ok", value: [{ name: "dependency-records.json", kind: "file" }] }),
        ...UNUSED_BASE,
      }),
      repoRoot: REPO,
    });
    expect(folder.read()).toEqual({ outcome: "failed", error: { kind: "records-file-not-json", file: "hone-records/dependency-records.json", detail: expect.any(String) } });
  });
});

describe("createRecordsFolder, readAt", () => {
  it("reads the records files the base revision holds, and nothing else it holds", () => {
    const pathsAt = vi
      .fn<GitTreePort["pathsAt"]>()
      .mockReturnValue({ outcome: "ok", value: [repoPathOf("src/a.ts"), repoPathOf("hone-records/debt/claimed-type.json"), repoPathOf("hone-records/README.md")] });
    const textInBase = vi.fn<GitPort["textInBase"]>().mockReturnValue({ outcome: "ok", value: { presence: "present-in-base", text: DEBT_TEXT } });
    const folder = createRecordsFolder({
      ...portsWith({ exists: vi.fn<FileTextPort["exists"]>(), read: vi.fn<FileTextPort["read"]>(), list: vi.fn<DirectoryPort["list"]>(), pathsAt, textInBase }),
      repoRoot: REPO,
    });
    expect({ read: folder.readAt({ revision: "origin/main" }), asked: textInBase.mock.calls }).toEqual({
      read: { outcome: "ok", value: [{ file: "hone-records/debt/claimed-type.json", document: { version: 2, records: [{ answers: "claimed-type", file: "src/a.ts" }] } }] },
      asked: [[{ repoRoot: REPO, baseRevision: "origin/main", file: "hone-records/debt/claimed-type.json" }]],
    });
  });

  it("fails with git's failure when the base revision cannot be listed", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>(),
        read: vi.fn<FileTextPort["read"]>(),
        list: vi.fn<DirectoryPort["list"]>(),
        pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "failed", error: { kind: "git-failed", command: "git ls-tree", detail: "bad revision" } }),
        textInBase: vi.fn<GitPort["textInBase"]>(),
      }),
      repoRoot: REPO,
    });
    expect(folder.readAt({ revision: "nowhere" })).toEqual({ outcome: "failed", error: { kind: "git-failed", command: "git ls-tree", detail: "bad revision" } });
  });

  it("fails naming a base records file that is not JSON", () => {
    const folder = createRecordsFolder({
      ...portsWith({
        exists: vi.fn<FileTextPort["exists"]>(),
        read: vi.fn<FileTextPort["read"]>(),
        list: vi.fn<DirectoryPort["list"]>(),
        pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [repoPathOf("hone-records/dependency-records.json")] }),
        textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue({ outcome: "ok", value: { presence: "present-in-base", text: "[" } }),
      }),
      repoRoot: REPO,
    });
    expect(folder.readAt({ revision: "origin/main" })).toEqual({
      outcome: "failed",
      error: { kind: "records-file-not-json", file: "hone-records/dependency-records.json", detail: expect.any(String) },
    });
  });
});
