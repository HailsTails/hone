import { describe, expect, it, type Mock, vi } from "vitest";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import { createPathPort } from "../../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { type PlannedFile, type ProofWritePorts, type ProofWrites, rolledBackProofWrites, writeProofFiles } from "./proof-writes.ts";

type RecordedMock = {
  readonly mock: { readonly calls: readonly (readonly unknown[])[]; readonly invocationCallOrder: readonly number[] };
};

type RecordedCall = { readonly port: string; readonly arguments: readonly unknown[] };

type OrderedCall = RecordedCall & { readonly order: number };

const orderedCallsOf = (request: { readonly port: string; readonly mock: RecordedMock }): readonly OrderedCall[] =>
  request.mock.mock.calls.map((callArguments, index) => ({ port: request.port, arguments: callArguments, order: request.mock.mock.invocationCallOrder[index] }));

const callSequenceOf = (request: { readonly mocks: Readonly<Record<string, RecordedMock>> }): readonly RecordedCall[] =>
  Object.entries(request.mocks)
    .flatMap(([port, mock]) => orderedCallsOf({ port, mock }))
    .toSorted((left, right) => left.order - right.order)
    .map(({ port, arguments: callArguments }) => ({ port, arguments: callArguments }));

const REPO = absolutePathSchema.parse("/repo");

const RECORDS_FOLDER = absolutePathSchema.parse("/repo/hone-records");

const DEBT_FOLDER = absolutePathSchema.parse("/repo/hone-records/debt");

const DEBT_FILE: PlannedFile = { path: absolutePathSchema.parse("/repo/hone-records/debt/loop-keyword.json"), text: "debt text" };

const CONFIG = absolutePathSchema.parse("/repo/eslint.config.mjs");

const REWRITTEN_CONFIG: PlannedFile = { path: CONFIG, text: "rewritten config" };

const PACKAGE_CONFIG = absolutePathSchema.parse("/repo/packages/a/eslint.config.mjs");

const REWRITTEN_PACKAGE_CONFIG: PlannedFile = { path: PACKAGE_CONFIG, text: "rewritten package config" };

const ORIGINAL_CONFIG = "original config";

const WRITTEN: ProofWrites = [
  { kind: "directory-created", path: RECORDS_FOLDER },
  { kind: "directory-created", path: DEBT_FOLDER },
  { kind: "file-created", path: DEBT_FILE.path },
  { kind: "file-replaced", path: CONFIG, original: ORIGINAL_CONFIG },
];

const ok = { outcome: "ok", value: undefined } as const;

const kindsOfNewFileUnderNewFolders = () =>
  vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent").mockReturnValueOnce("absent").mockReturnValueOnce("absent").mockReturnValueOnce("directory");

const kindsOfNewFileUnderExistingFolder = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent").mockReturnValueOnce("directory");

const kindsOfExistingFile = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file");

const kindsOfNewFileOnly = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent");

const noKindsAsked = () => vi.fn<EntryKindPort["kindOf"]>();

type MockedPorts = {
  readonly fileText: { readonly read: Mock<FileTextPort["read"]>; readonly exists: Mock<FileTextPort["exists"]>; readonly write: Mock<FileTextPort["write"]> };
  readonly fileCreation: { readonly createNew: Mock<FileCreationPort["createNew"]> };
  readonly fileRemoval: { readonly remove: Mock<FileRemovalPort["remove"]> };
  readonly directory: { readonly list: Mock<DirectoryPort["list"]>; readonly create: Mock<DirectoryPort["create"]> };
  readonly directoryRemoval: { readonly removeEmpty: Mock<DirectoryRemovalPort["removeEmpty"]> };
  readonly entryKind: { readonly kindOf: Mock<EntryKindPort["kindOf"]> };
  readonly path: ProofWritePorts["path"];
};

const portsOver = (request: { readonly kindOf: Mock<EntryKindPort["kindOf"]> }): MockedPorts => ({
  fileText: {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: ORIGINAL_CONFIG }),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>().mockReturnValue(ok),
  },
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>().mockReturnValue(ok) },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
  directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>().mockReturnValue(ok) },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok) },
  entryKind: { kindOf: request.kindOf },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
});

const sequenceOf = (request: { readonly ports: MockedPorts }) =>
  callSequenceOf({
    mocks: {
      kindOf: request.ports.entryKind.kindOf,
      read: request.ports.fileText.read,
      create: request.ports.directory.create,
      createNew: request.ports.fileCreation.createNew,
      write: request.ports.fileText.write,
      remove: request.ports.fileRemoval.remove,
      removeEmpty: request.ports.directoryRemoval.removeEmpty,
    },
  });

const PLANNING = [
  { port: "kindOf", arguments: [{ path: DEBT_FILE.path }] },
  { port: "read", arguments: [{ path: CONFIG }] },
  { port: "kindOf", arguments: [{ path: DEBT_FOLDER }] },
  { port: "kindOf", arguments: [{ path: RECORDS_FOLDER }] },
  { port: "kindOf", arguments: [{ path: REPO }] },
];

const CREATING_FOLDERS = [
  { port: "create", arguments: [{ path: RECORDS_FOLDER }] },
  { port: "create", arguments: [{ path: DEBT_FOLDER }] },
];

const REMOVING_FOLDERS = [
  { port: "removeEmpty", arguments: [{ path: DEBT_FOLDER }] },
  { port: "removeEmpty", arguments: [{ path: RECORDS_FOLDER }] },
];

const CREATING_FILE = { port: "createNew", arguments: [{ path: DEBT_FILE.path, text: "debt text" }] };

const REWRITING_CONFIG = { port: "write", arguments: [{ path: CONFIG, text: "rewritten config" }] };

describe("writeProofFiles", () => {
  it("creates the missing folders shallowest first, creates the new files, then replaces the config, and records each", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({ outcome: "ok", value: WRITTEN });
    expect(sequenceOf({ ports })).toEqual([...PLANNING, ...CREATING_FOLDERS, CREATING_FILE, REWRITING_CONFIG]);
  });

  it("replaces every config in the order given, reading all their originals before any write", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG, REWRITTEN_PACKAGE_CONFIG] })).toEqual({
      outcome: "ok",
      value: [...WRITTEN, { kind: "file-replaced", path: PACKAGE_CONFIG, original: ORIGINAL_CONFIG }],
    });
    expect(sequenceOf({ ports })).toEqual([
      { port: "kindOf", arguments: [{ path: DEBT_FILE.path }] },
      { port: "read", arguments: [{ path: CONFIG }] },
      { port: "read", arguments: [{ path: PACKAGE_CONFIG }] },
      { port: "kindOf", arguments: [{ path: DEBT_FOLDER }] },
      { port: "kindOf", arguments: [{ path: RECORDS_FOLDER }] },
      { port: "kindOf", arguments: [{ path: REPO }] },
      ...CREATING_FOLDERS,
      CREATING_FILE,
      REWRITING_CONFIG,
      { port: "write", arguments: [{ path: PACKAGE_CONFIG, text: "rewritten package config" }] },
    ]);
  });

  it("restores the config it already replaced when a later replacement cannot be written", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileText.write.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "unwritable", path: PACKAGE_CONFIG, detail: "disk full" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG, REWRITTEN_PACKAGE_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "unwritable", path: PACKAGE_CONFIG, detail: "disk full" }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([
      { port: "kindOf", arguments: [{ path: DEBT_FILE.path }] },
      { port: "read", arguments: [{ path: CONFIG }] },
      { port: "read", arguments: [{ path: PACKAGE_CONFIG }] },
      { port: "kindOf", arguments: [{ path: DEBT_FOLDER }] },
      { port: "kindOf", arguments: [{ path: RECORDS_FOLDER }] },
      { port: "kindOf", arguments: [{ path: REPO }] },
      ...CREATING_FOLDERS,
      CREATING_FILE,
      REWRITING_CONFIG,
      { port: "write", arguments: [{ path: PACKAGE_CONFIG, text: "rewritten package config" }] },
      { port: "write", arguments: [{ path: PACKAGE_CONFIG, text: ORIGINAL_CONFIG }] },
      { port: "write", arguments: [{ path: CONFIG, text: ORIGINAL_CONFIG }] },
      { port: "remove", arguments: [{ path: DEBT_FILE.path }] },
      ...REMOVING_FOLDERS,
    ]);
  });

  it("creates no folder that already exists", () => {
    const projection = { path: absolutePathSchema.parse("/repo/hone.eslint.mjs"), text: "projection" };
    const ports = portsOver({ kindOf: kindsOfNewFileUnderExistingFolder() });
    expect(writeProofFiles({ ports, files: [projection], replacements: [] })).toEqual({
      outcome: "ok",
      value: [{ kind: "file-created", path: projection.path }],
    });
    expect(sequenceOf({ ports })).toEqual([
      { port: "kindOf", arguments: [{ path: projection.path }] },
      { port: "kindOf", arguments: [{ path: REPO }] },
      { port: "createNew", arguments: [{ path: projection.path, text: "projection" }] },
    ]);
  });

  it("refuses before any write when a planned file already exists", () => {
    const ports = portsOver({ kindOf: kindsOfExistingFile() });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "path-already-exists", path: DEBT_FILE.path }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([{ port: "kindOf", arguments: [{ path: DEBT_FILE.path }] }]);
  });

  it("refuses before any write when the file it would replace cannot be read", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileOnly() });
    ports.fileText.read.mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: CONFIG, detail: "ENOENT" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "replaced-file-unreadable", path: CONFIG, detail: "ENOENT" }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([
      { port: "kindOf", arguments: [{ path: DEBT_FILE.path }] },
      { port: "read", arguments: [{ path: CONFIG }] },
    ]);
  });

  it("leaves nothing behind when the first folder cannot be created", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.directory.create.mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-uncreatable", path: RECORDS_FOLDER, detail: "EACCES" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "directory-uncreatable", path: RECORDS_FOLDER, detail: "EACCES" }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([...PLANNING, { port: "create", arguments: [{ path: RECORDS_FOLDER }] }]);
  });

  it("refuses a name taken after the check, a link included, and removes only the folders it created", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileCreation.createNew.mockReturnValueOnce({ outcome: "failed", error: { kind: "already-exists", path: DEBT_FILE.path } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "path-already-exists", path: DEBT_FILE.path }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([...PLANNING, ...CREATING_FOLDERS, CREATING_FILE, ...REMOVING_FOLDERS]);
  });

  it("removes the folders it created, deepest first, when a new file cannot be created", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileCreation.createNew.mockReturnValueOnce({ outcome: "failed", error: { kind: "uncreatable", path: DEBT_FILE.path, detail: "ENOSPC" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "unwritable", path: DEBT_FILE.path, detail: "ENOSPC" }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([...PLANNING, ...CREATING_FOLDERS, CREATING_FILE, ...REMOVING_FOLDERS]);
  });

  it("restores the config's original bytes and removes what it created when the config cannot be rewritten", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileText.write.mockReturnValueOnce({ outcome: "failed", error: { kind: "unwritable", path: CONFIG, detail: "EPERM" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "unwritable", path: CONFIG, detail: "EPERM" }, unrestored: [] },
    });
    expect(sequenceOf({ ports })).toEqual([
      ...PLANNING,
      ...CREATING_FOLDERS,
      CREATING_FILE,
      REWRITING_CONFIG,
      { port: "write", arguments: [{ path: CONFIG, text: ORIGINAL_CONFIG }] },
      { port: "remove", arguments: [{ path: DEBT_FILE.path }] },
      ...REMOVING_FOLDERS,
    ]);
  });

  it("names each path it could not restore beside the failure that stopped the writes", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileCreation.createNew.mockReturnValueOnce({ outcome: "failed", error: { kind: "uncreatable", path: DEBT_FILE.path, detail: "ENOSPC" } });
    ports.directoryRemoval.removeEmpty.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unremovable", path: RECORDS_FOLDER, detail: "EBUSY" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacements: [REWRITTEN_CONFIG] })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "unwritable", path: DEBT_FILE.path, detail: "ENOSPC" }, unrestored: [{ written: "directory-created", path: RECORDS_FOLDER, detail: "EBUSY" }] },
    });
  });
});

describe("rolledBackProofWrites", () => {
  it("undoes the writes in reverse: the config's original bytes, the created file, then the created folders deepest first", () => {
    const ports = portsOver({ kindOf: noKindsAsked() });
    expect(rolledBackProofWrites({ ports, writes: WRITTEN })).toEqual([]);
    expect(sequenceOf({ ports })).toEqual([
      { port: "write", arguments: [{ path: CONFIG, text: ORIGINAL_CONFIG }] },
      { port: "remove", arguments: [{ path: DEBT_FILE.path }] },
      ...REMOVING_FOLDERS,
    ]);
  });

  it("reports each path it could not undo and still undoes the rest", () => {
    const ports = portsOver({ kindOf: noKindsAsked() });
    ports.fileRemoval.remove.mockReturnValue({ outcome: "failed", error: { kind: "unremovable", path: DEBT_FILE.path, detail: "EBUSY" } });
    expect(rolledBackProofWrites({ ports, writes: WRITTEN })).toEqual([{ written: "file-created", path: DEBT_FILE.path, detail: "EBUSY" }]);
    expect(sequenceOf({ ports })).toEqual([
      { port: "write", arguments: [{ path: CONFIG, text: ORIGINAL_CONFIG }] },
      { port: "remove", arguments: [{ path: DEBT_FILE.path }] },
      ...REMOVING_FOLDERS,
    ]);
  });

  it("undoes nothing when nothing was written", () => {
    const ports = portsOver({ kindOf: noKindsAsked() });
    expect(rolledBackProofWrites({ ports, writes: [] })).toEqual([]);
    expect(sequenceOf({ ports })).toEqual([]);
  });
});
