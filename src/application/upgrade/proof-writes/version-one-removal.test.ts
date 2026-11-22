import { describe, expect, it, type Mock, vi } from "vitest";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { PathPort, RelativeLocation } from "../../ports/host/path-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { removedVersionOneFiles, type VersionOneRemoval, type VersionOneRemovalPorts } from "./version-one-removal.ts";

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

const ROOT = absolutePathSchema.parse("/repo/discipline-exceptions");

const AUTHORISED_FOLDER = absolutePathSchema.parse("/repo/discipline-exceptions/authorised-locations");

const CARVE_OUT_FILE = absolutePathSchema.parse("/repo/discipline-exceptions/file-carve-outs/cd-15.json");

const CARVE_OUT_FOLDER = absolutePathSchema.parse("/repo/discipline-exceptions/file-carve-outs");

const AUTHORISED_FILE = absolutePathSchema.parse("/repo/discipline-exceptions/authorised-locations/cd-15.json");

const PROJECTION = absolutePathSchema.parse("/repo/disciplines.eslint.mjs");

const SETTINGS = absolutePathSchema.parse("/repo/disciplines.json");

const REMOVAL: VersionOneRemoval = { recordsFiles: [CARVE_OUT_FILE, AUTHORISED_FILE], recordsFolders: [], recordsRoot: { kind: "folder", path: ROOT }, projections: [PROJECTION], settings: SETTINGS };

const SLICE = absolutePathSchema.parse("/repo/packages/a/disciplines.eslint.mjs");

const DIRECT = absolutePathSchema.parse("/repo/discipline-exceptions/records.json");

const SINGLE = absolutePathSchema.parse("/repo/discipline-exceptions.json");

const REPOSITORY = absolutePathSchema.parse("/repo");

const OUTSIDE = absolutePathSchema.parse("/repo/tools/x.json");

const OTHER_CASE = absolutePathSchema.parse("/repo/Discipline-Exceptions/file-carve-outs/cd-15.json");

const ok = { outcome: "ok", value: undefined } as const;

const IN_CARVE_OUT_FOLDER: RelativeLocation = { relation: "within-root", path: "file-carve-outs/cd-15.json" };

const IN_AUTHORISED_FOLDER: RelativeLocation = { relation: "within-root", path: "authorised-locations/cd-15.json" };

const pathOver = (request: { readonly relative: PathPort["relative"] }): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValueOnce(CARVE_OUT_FOLDER).mockReturnValueOnce(AUTHORISED_FOLDER),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: request.relative,
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

const relativeToRecordsFolderFiles = () =>
  vi
    .fn<PathPort["relative"]>()
    .mockReturnValueOnce(IN_CARVE_OUT_FOLDER)
    .mockReturnValueOnce(IN_AUTHORISED_FOLDER)
    .mockReturnValueOnce(IN_CARVE_OUT_FOLDER)
    .mockReturnValueOnce(IN_AUTHORISED_FOLDER);

type MockedPorts = {
  readonly fileRemoval: { readonly remove: Mock<FileRemovalPort["remove"]> };
  readonly directory: { readonly list: Mock<DirectoryPort["list"]>; readonly create: Mock<DirectoryPort["create"]> };
  readonly directoryRemoval: { readonly removeEmpty: Mock<DirectoryRemovalPort["removeEmpty"]> };
  readonly path: VersionOneRemovalPorts["path"];
};

const portsOver = (request: { readonly relative: PathPort["relative"] } = { relative: relativeToRecordsFolderFiles() }): MockedPorts => ({
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
  directory: { list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] }), create: vi.fn<DirectoryPort["create"]>() },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok) },
  path: pathOver(request),
});

const sequenceOf = (request: { readonly ports: MockedPorts }) =>
  callSequenceOf({
    mocks: { remove: request.ports.fileRemoval.remove, list: request.ports.directory.list, removeEmpty: request.ports.directoryRemoval.removeEmpty },
  });

const REMOVING_RECORDS = [
  { port: "remove", arguments: [{ path: CARVE_OUT_FILE }] },
  { port: "remove", arguments: [{ path: AUTHORISED_FILE }] },
];

const REMOVING_AUTHORISED_FOLDER = [
  { port: "list", arguments: [{ path: AUTHORISED_FOLDER }] },
  { port: "removeEmpty", arguments: [{ path: AUTHORISED_FOLDER }] },
];

const REMOVING_CARVE_OUT_FOLDER = [
  { port: "list", arguments: [{ path: CARVE_OUT_FOLDER }] },
  { port: "removeEmpty", arguments: [{ path: CARVE_OUT_FOLDER }] },
];

const REMOVING_ROOT = [
  { port: "list", arguments: [{ path: ROOT }] },
  { port: "removeEmpty", arguments: [{ path: ROOT }] },
];

const REMOVING_PROJECTION = { port: "remove", arguments: [{ path: PROJECTION }] };

const REMOVING_SETTINGS = { port: "remove", arguments: [{ path: SETTINGS }] };

describe("removedVersionOneFiles", () => {
  it("removes the records files, then the emptied folders deepest first, the records folder last of them, then the projection, and the settings file last", () => {
    const ports = portsOver();
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "ok",
      value: {
        files: [CARVE_OUT_FILE, AUTHORISED_FILE, PROJECTION, SETTINGS],
        folders: [AUTHORISED_FOLDER, CARVE_OUT_FOLDER, ROOT],
      },
    });
    expect(sequenceOf({ ports })).toEqual([
      ...REMOVING_RECORDS,
      ...REMOVING_AUTHORISED_FOLDER,
      ...REMOVING_CARVE_OUT_FOLDER,
      ...REMOVING_ROOT,
      REMOVING_PROJECTION,
      REMOVING_SETTINGS,
    ]);
  });

  it("removes the empty folders listed with no records file, deepest first, the records folder last", () => {
    const ports = portsOver();
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [], recordsFolders: [ROOT, CARVE_OUT_FOLDER] } })).toEqual({
      outcome: "ok",
      value: { files: [PROJECTION, SETTINGS], folders: [CARVE_OUT_FOLDER, ROOT] },
    });
    expect(sequenceOf({ ports })).toEqual([...REMOVING_CARVE_OUT_FOLDER, ...REMOVING_ROOT, REMOVING_PROJECTION, REMOVING_SETTINGS]);
  });

  it("leaves a folder that still holds something", () => {
    const ports = portsOver();
    ports.directory.list.mockReturnValueOnce({ outcome: "ok", value: [] }).mockReturnValueOnce({ outcome: "ok", value: [{ name: "notes.md", kind: "file" }] });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "ok",
      value: { files: [CARVE_OUT_FILE, AUTHORISED_FILE, PROJECTION, SETTINGS], folders: [AUTHORISED_FOLDER, ROOT] },
    });
    expect(sequenceOf({ ports })).toEqual([
      ...REMOVING_RECORDS,
      ...REMOVING_AUTHORISED_FOLDER,
      { port: "list", arguments: [{ path: CARVE_OUT_FOLDER }] },
      ...REMOVING_ROOT,
      REMOVING_PROJECTION,
      REMOVING_SETTINGS,
    ]);
  });

  it("tries only the records folder for a records file directly under it", () => {
    const ports = portsOver({ relative: vi.fn<PathPort["relative"]>().mockReturnValue({ relation: "within-root", path: "records.json" }) });
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [DIRECT], projections: [] } })).toEqual({
      outcome: "ok",
      value: { files: [DIRECT, SETTINGS], folders: [ROOT] },
    });
    expect(sequenceOf({ ports })).toEqual([{ port: "remove", arguments: [{ path: DIRECT }] }, ...REMOVING_ROOT, REMOVING_SETTINGS]);
  });

  it("removes a records file at the repository root and no folder, since the root is not a records folder", () => {
    const ports = portsOver({ relative: vi.fn<PathPort["relative"]>().mockReturnValue({ relation: "within-root", path: "discipline-exceptions.json" }) });
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [SINGLE], recordsRoot: { kind: "repository", path: REPOSITORY } } })).toEqual({
      outcome: "ok",
      value: { files: [SINGLE, PROJECTION, SETTINGS], folders: [] },
    });
    expect(sequenceOf({ ports })).toEqual([{ port: "remove", arguments: [{ path: SINGLE }] }, REMOVING_PROJECTION, REMOVING_SETTINGS]);
  });

  it("removes every projection, the root one and a slice, after the records and before the settings file", () => {
    const ports = portsOver();
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [], projections: [PROJECTION, SLICE] } })).toEqual({
      outcome: "ok",
      value: { files: [PROJECTION, SLICE, SETTINGS], folders: [] },
    });
    expect(sequenceOf({ ports })).toEqual([REMOVING_PROJECTION, { port: "remove", arguments: [{ path: SLICE }] }, REMOVING_SETTINGS]);
  });

  it("removes no projection when none is given", () => {
    const ports = portsOver();
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, projections: [] } })).toEqual({
      outcome: "ok",
      value: { files: [CARVE_OUT_FILE, AUTHORISED_FILE, SETTINGS], folders: [AUTHORISED_FOLDER, CARVE_OUT_FOLDER, ROOT] },
    });
    expect(sequenceOf({ ports })).toEqual([...REMOVING_RECORDS, ...REMOVING_AUTHORISED_FOLDER, ...REMOVING_CARVE_OUT_FOLDER, ...REMOVING_ROOT, REMOVING_SETTINGS]);
  });

  it("refuses, before removing anything, a records file that is not under the records folder", () => {
    const ports = portsOver({ relative: vi.fn<PathPort["relative"]>().mockReturnValueOnce(IN_CARVE_OUT_FOLDER).mockReturnValueOnce({ relation: "within-root", path: "../tools/x.json" }) });
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [CARVE_OUT_FILE, OUTSIDE] } })).toEqual({
      outcome: "failed",
      error: { kind: "records-file-outside-root", path: OUTSIDE, root: ROOT },
    });
    expect(sequenceOf({ ports })).toEqual([]);
  });

  it("refuses a records file whose path differs from the records folder's only in case", () => {
    const ports = portsOver({ relative: vi.fn<PathPort["relative"]>().mockReturnValue({ relation: "within-root", path: "../Discipline-Exceptions/file-carve-outs/cd-15.json" }) });
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [OTHER_CASE] } })).toEqual({
      outcome: "failed",
      error: { kind: "records-file-outside-root", path: OTHER_CASE, root: ROOT },
    });
    expect(sequenceOf({ ports })).toEqual([]);
  });

  it("refuses the records folder itself listed as a records file", () => {
    const ports = portsOver({ relative: vi.fn<PathPort["relative"]>().mockReturnValue({ relation: "within-root", path: "" }) });
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, recordsFiles: [ROOT] } })).toEqual({
      outcome: "failed",
      error: { kind: "records-file-outside-root", path: ROOT, root: ROOT },
    });
    expect(sequenceOf({ ports })).toEqual([]);
  });

  it("stops at the first file it cannot remove and says what it had removed, so the settings file stays", () => {
    const ports = portsOver();
    ports.fileRemoval.remove.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "unremovable", path: AUTHORISED_FILE, detail: "EBUSY" } });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: AUTHORISED_FILE, detail: "EBUSY", removed: { files: [CARVE_OUT_FILE], folders: [] } },
    });
    expect(sequenceOf({ ports })).toEqual(REMOVING_RECORDS);
  });

  it("stops when a folder cannot be listed", () => {
    const ports = portsOver();
    ports.directory.list.mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: AUTHORISED_FOLDER, detail: "EACCES" } });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: AUTHORISED_FOLDER, detail: "EACCES", removed: { files: [CARVE_OUT_FILE, AUTHORISED_FILE], folders: [] } },
    });
    expect(sequenceOf({ ports })).toEqual([...REMOVING_RECORDS, { port: "list", arguments: [{ path: AUTHORISED_FOLDER }] }]);
  });

  it("stops when a listed empty folder cannot be removed", () => {
    const ports = portsOver();
    ports.directoryRemoval.removeEmpty.mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unremovable", path: AUTHORISED_FOLDER, detail: "EBUSY" } });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: AUTHORISED_FOLDER, detail: "EBUSY", removed: { files: [CARVE_OUT_FILE, AUTHORISED_FILE], folders: [] } },
    });
    expect(sequenceOf({ ports })).toEqual([...REMOVING_RECORDS, ...REMOVING_AUTHORISED_FOLDER]);
  });
});
