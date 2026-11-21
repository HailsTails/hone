import { describe, expect, it, vi } from "vitest";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import type { RecordsSource } from "../../ports/records/records-source.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { PlacedEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import { foundTreeRecordsSourceOver } from "./found-tree-records-source.ts";
import { FOUND_TREE_REVISION } from "./found-tree-reach.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT_ENGINE], forms: [] };

const LOOP_KEYWORD_TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const REBINDING_TEST_BODY: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "a-for-loop", symptom: LOOP_KEYWORD },
          { section: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

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
