import { assert, describe, expect, it, vi } from "vitest";
import type { SelectionRepository } from "./consumer-selection.ts";
import type { FileTextPort } from "../node/file-system/file-text-port.ts";
import { createPathPort } from "../node/path-port.ts";
import type { SelectionReading } from "../../domain/settings/selection/selection.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { ExceptionRepository, PlacedEntry } from "../discipline-exceptions-folder/exception-records.ts";
import type { RecordsOnDisk } from "../discipline-exceptions-folder/version-one-records-on-disk.ts";
import { versionOneReadOf, type VersionOneReadRequest } from "./version-one-reading.ts";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const AUDIT = mechanismIdSchema.parse("audit");

const SELECTION_TEXT = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-15#loops": "eslint" } }';

const READING: SelectionReading = {
  selection: { selected: [{ address: LOOPS, mechanism: AUDIT, exceptions: "allowed" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [],
  clauseRoots: [],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
};

const SINGLE_FILE = repoPathSchema.parse("discipline-exceptions.json");

const CARVE_OUT_ENTRY = { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" } as const;

const SINGLE_FILE_ENTRIES: readonly PlacedEntry[] = [
  { place: { layout: "single-file", file: SINGLE_FILE, index: 0 }, entry: CARVE_OUT_ENTRY },
  { place: { layout: "single-file", file: SINGLE_FILE, index: 1 }, entry: { ...CARVE_OUT_ENTRY, file: "src/b.ts" } },
];

const SPLIT_ENTRIES: readonly PlacedEntry[] = [
  { place: { layout: "split", file: repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json"), index: 0 }, entry: CARVE_OUT_ENTRY },
];

type Held = {
  readonly entries: readonly PlacedEntry[];
  readonly reading: SelectionReading;
  readonly selectionText: string;
  readonly recordsOnDisk: RecordsOnDisk;
};

const NO_RECORDS_ON_DISK: RecordsOnDisk = { files: [], folders: [], root: { kind: "folder", folder: repoPathSchema.parse("discipline-exceptions") } };

const SINGLE_FILE_ON_DISK: RecordsOnDisk = { files: [SINGLE_FILE], folders: [], root: { kind: "repository" } };

const SPLIT_ON_DISK: RecordsOnDisk = {
  files: [repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json")],
  folders: [repoPathSchema.parse("discipline-exceptions"), repoPathSchema.parse("discipline-exceptions/file-carve-outs")],
  root: { kind: "folder", folder: repoPathSchema.parse("discipline-exceptions") },
};

const NOTHING_HELD: Held = {
  entries: [],
  reading: READING,
  selectionText: SELECTION_TEXT,
  recordsOnDisk: NO_RECORDS_ON_DISK,
};

const requestOver = (held: Held): VersionOneReadRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  fileText: {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: held.selectionText }),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: held.reading }) },
  exceptionRepository: { read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: held.entries }) },
  recordsOnDisk: held.recordsOnDisk,
});

describe("versionOneReadOf", () => {
  it("reads the settings, the records as heads, and the files that hold them", () => {
    const read = versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: SINGLE_FILE_ENTRIES, recordsOnDisk: SINGLE_FILE_ON_DISK }));
    assert(read.outcome === "ok", "the repository reads");
    expect(read.value.versionOneFiles).toEqual({ recordsFiles: ["discipline-exceptions.json"], recordsFolders: [], recordsRoot: { kind: "repository" }, settings: "disciplines.json" });  });

  it("takes the files and folders on disk as the ones to remove, whatever the entries say", () => {
    const read = versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: SPLIT_ENTRIES, recordsOnDisk: SPLIT_ON_DISK }));
    assert(read.outcome === "ok", "the repository reads");
    expect(read.value.versionOneFiles).toEqual({
      recordsFiles: ["discipline-exceptions/file-carve-outs/cd-15.json"],
      recordsFolders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs"],
      recordsRoot: { kind: "folder", folder: "discipline-exceptions" },
      settings: "disciplines.json",
    });
  });

  it("removes a records file that lists no entries, since the files come from disk", () => {
    const read = versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: [], recordsOnDisk: SINGLE_FILE_ON_DISK }));
    assert(read.outcome === "ok", "the repository reads");
    expect(read.value.versionOneFiles).toEqual({ recordsFiles: ["discipline-exceptions.json"], recordsFolders: [], recordsRoot: { kind: "repository" }, settings: "disciplines.json" });
  });

  it("refuses records that do not parse, naming them", () => {
    const invalid: PlacedEntry = { place: { layout: "single-file", file: SINGLE_FILE, index: 0 }, entry: { kind: "file-carve-out", clause: "CD-15#unknown", file: "src/a.ts" } };
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: [invalid] }))).toMatchObject({
      outcome: "failed",
      error: { kind: "records-refused", refusal: { kind: "invalid-records" } },
    });
  });

  it("fails with the load failure when the settings file cannot be read", () => {
    const request = requestOver(NOTHING_HELD);
    vi.mocked(request.fileText.read).mockReset().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.json", detail: "ENOENT" } });
    expect(versionOneReadOf(request)).toMatchObject({ outcome: "failed", error: { kind: "version-one-unreadable", failure: { kind: "file-unreadable" } } });
  });
});
