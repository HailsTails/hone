import { describe, expect, it, vi } from "vitest";
import { SETTINGS_CATALOGUE } from "../../../../tests/settings-catalogue.ts";
import type { RecordsDocument } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsSource } from "../../ports/records-source.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRepository, PlacedEntry } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { foundTreeRecordsSourceOver } from "./found-tree-records-source.ts";
import { FOUND_TREE_REVISION } from "./found-tree-reach.ts";

const ENTRY = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" } as const;

const PLACED: PlacedEntry = { place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 }, entry: ENTRY };

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: repoPathSchema.parse("hone-records/authorised-locations/loop-keyword.json"),
  document: { version: 2, records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: ENTRY }] },
};

const WRITTEN_DOCUMENT: RecordsDocument = { file: repoPathSchema.parse("hone-records/debt/loop-keyword.json"), document: { version: 2, records: [] } };

const exceptionsReading = (): Pick<ExceptionRepository, "read" | "readAt"> => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [PLACED] }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
});

const sourceReading = (): RecordsSource => ({
  read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: [WRITTEN_DOCUMENT] }),
  readAt: vi.fn<RecordsSource["readAt"]>(),
});

describe("foundTreeRecordsSourceOver", () => {
  it("reads the records the working tree holds as they are", () => {
    const source = foundTreeRecordsSourceOver({ source: sourceReading(), exceptions: exceptionsReading(), catalogue: SETTINGS_CATALOGUE });
    expect(source.read()).toEqual({ outcome: "ok", value: [WRITTEN_DOCUMENT] });
  });

  it("holds at the base the records the working tree's version 1 entries become, and asks git for nothing", () => {
    const underlying = sourceReading();
    const exceptions = exceptionsReading();
    const source = foundTreeRecordsSourceOver({ source: underlying, exceptions, catalogue: SETTINGS_CATALOGUE });
    expect({
      atBase: source.readAt({ revision: FOUND_TREE_REVISION }),
      askedRecords: vi.mocked(underlying.readAt).mock.calls,
      askedEntries: vi.mocked(exceptions.readAt).mock.calls,
    }).toEqual({ atBase: { outcome: "ok", value: [AUTHORISED_DOCUMENT] }, askedRecords: [], askedEntries: [] });
  });
});
