import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../../../tests/causal-why-chain.ts";
import { CAST_CHECK, CLAIMED_TYPE, GIVES_A_VALUE_ITS_TYPE, OWED_DECLARED_NOT_ASSERTED, WORLD_VALUES_THROUGH_A_PORT, WHOLE_SYMPTOM } from "../../../../tests/report-catalogue.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import type { CatalogueNote, HoneRecord, RecordRefusal } from "../../hone-records-folder/hone-record.ts";
import { carriedLine, recordNoteLine, recordPlaceText, recordReferenceText, recordSubjectText, refusedLines } from "./record-lines.ts";

const FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const AUTHORISED_FILE = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

const BOUNDARIES_FILE = repoPathSchema.parse("hone-records/boundary-records.json");

const CLOCK_ADAPTER = repoPathSchema.parse("src/adapters/system-clock.ts");

const STATED_DEBT: HoneRecord = { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: FILE, holding: { held: "stated" } };

const CARRIED_DEBT: HoneRecord = { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: FILE, holding: { held: "carried", entry: {}, lacks: [], standing: "established" } };

const MATCHED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: {
    held: "stated",
    owing: { matches: "the-catalogue", case: GIVES_A_VALUE_ITS_TYPE, owes: OWED_DECLARED_NOT_ASSERTED },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const UNKNOWN_CASE_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: { held: "stated", owing: { matches: "not-the-catalogue", note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" } }, whyChain: CAUSAL_WHY_CHAIN },
};

const UNOWED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: { held: "stated", owing: { matches: "not-the-catalogue", note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written out answers" } }, whyChain: CAUSAL_WHY_CHAIN },
};

const CARRIED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: { held: "carried", entry: {}, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
};

const DEVIATION: HoneRecord = {
  kind: "deviation",
  recipe: WORLD_VALUES_THROUGH_A_PORT,
  file: FILE,
  reasonFails: "Fails.",
  evidence: "Evidence.",
  ruleHolds: "Holds.",
};

const CLOCK_BOUNDARY: HoneRecord = {
  kind: "boundary-record",
  module: CLOCK_ADAPTER,
  outsideParty: { kind: "runtime", facility: "clock" },
  holding: { held: "stated", ports: ["Clock"] },
};

const FS_BOUNDARY: HoneRecord = {
  kind: "boundary-record",
  module: repoPathSchema.parse("src/adapters/files"),
  outsideParty: { kind: "scheme-module", specifier: "node:fs" },
  holding: { held: "carried", entry: {}, lacks: ["ports"], standing: "established" },
};

const UUID_BOUNDARY: HoneRecord = {
  kind: "boundary-record",
  module: repoPathSchema.parse("src/adapters/ids"),
  outsideParty: { kind: "package", specifier: "uuid/v4", dependency: "uuid" },
  holding: { held: "stated", ports: ["Ids"] },
};

const DEPENDENCY: HoneRecord = { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "Not enough." };

const CAST_DEBT: HoneRecord = { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "one-check", check: CAST_CHECK }, file: FILE, holding: { held: "stated" } };

const UNKNOWN_CHECK_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "unknown-check", check: "cast-old" },
  file: FILE,
  holding: { held: "stated", owing: { matches: "the-catalogue", case: GIVES_A_VALUE_ITS_TYPE, owes: OWED_DECLARED_NOT_ASSERTED }, whyChain: CAUSAL_WHY_CHAIN },
};

const CARRIED_UNKNOWN_CHECK_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "unknown-check", check: "cast-old" },
  file: FILE,
  holding: { held: "carried", entry: {}, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
};

describe("recordPlaceText", () => {
  it("names a record by its records file and its index in that file's records", () => {
    expect(recordPlaceText({ place: { file: DEBT_FILE, index: 3 } })).toBe("hone-records/debt/claimed-type.json records[3]");
  });

  it.each([
    { name: "a space", file: repoPathSchema.parse("hone-records/debt/claimed type.json"), text: '"hone-records/debt/claimed type.json" records[3]' },
    { name: "a double quote", file: repoPathSchema.parse('hone-records/debt/claimed"type.json'), text: '"hone-records/debt/claimed\\"type.json" records[3]' },
  ])("writes a records file whose name holds $name as a JSON string, so the file is always one field", ({ file, text }) => {
    expect(recordPlaceText({ place: { file, index: 3 } })).toBe(text);
  });
});

describe("recordSubjectText", () => {
  it.each([
    { name: "debt", record: STATED_DEBT, text: "claimed-type debt src/adapters/stripe-webhook.ts" },
    { name: "carried debt", record: CARRIED_DEBT, text: "claimed-type debt src/adapters/stripe-webhook.ts carried" },
    { name: "an authorised location that matches the catalogue", record: MATCHED_LOCATION, text: "claimed-type authorised-location src/adapters/stripe-webhook.ts" },
    {
      name: "an authorised location on a case the catalogue does not hold",
      record: UNKNOWN_CASE_LOCATION,
      text: 'claimed-type authorised-location src/adapters/stripe-webhook.ts note: the catalogue has no case "parses a webhook", owing "declared-not-asserted"',
    },
    {
      name: "an authorised location owing what its case does not owe",
      record: UNOWED_LOCATION,
      text: 'claimed-type authorised-location src/adapters/stripe-webhook.ts note: gives-a-value-its-type does not owe "written out answers"',
    },
    { name: "a carried authorised location", record: CARRIED_LOCATION, text: "claimed-type authorised-location src/adapters/stripe-webhook.ts carried" },
    { name: "a deviation", record: DEVIATION, text: "world-values-through-a-port deviation src/adapters/stripe-webhook.ts" },
    { name: "a boundary record on a runtime facility", record: CLOCK_BOUNDARY, text: "runtime:clock boundary-record src/adapters/system-clock.ts" },
    { name: "a carried boundary record on a scheme module", record: FS_BOUNDARY, text: "node:fs boundary-record src/adapters/files carried" },
    { name: "a boundary record on a package subpath", record: UUID_BOUNDARY, text: "uuid/v4 boundary-record src/adapters/ids" },
    { name: "a dependency record", record: DEPENDENCY, text: "zod dependency-record" },
    { name: "debt on one check", record: CAST_DEBT, text: "claimed-type#cast-expressions debt src/adapters/stripe-webhook.ts" },
    {
      name: "an authorised location naming a check its symptom does not have",
      record: UNKNOWN_CHECK_LOCATION,
      text: 'claimed-type#cast-old authorised-location src/adapters/stripe-webhook.ts note: the catalogue has no check "cast-old" of claimed-type',
    },
    {
      name: "a carried authorised location naming a check its symptom does not have",
      record: CARRIED_UNKNOWN_CHECK_LOCATION,
      text: 'claimed-type#cast-old authorised-location src/adapters/stripe-webhook.ts carried note: the catalogue has no check "cast-old" of claimed-type',
    },
  ])("names $name by what it holds, its kind and its site", ({ record, text }) => {
    expect(recordSubjectText({ record })).toBe(text);
  });
});

describe("recordReferenceText", () => {
  it.each([
    { name: "debt", record: STATED_DEBT, text: "debt" },
    { name: "carried debt", record: CARRIED_DEBT, text: "debt carried" },
    { name: "a matching authorised location", record: MATCHED_LOCATION, text: "authorised-location" },
    { name: "an authorised location with a note", record: UNOWED_LOCATION, text: 'authorised-location note: gives-a-value-its-type does not owe "written out answers"' },
    { name: "a boundary record", record: CLOCK_BOUNDARY, text: "boundary-record runtime:clock" },
    { name: "a deviation", record: DEVIATION, text: "deviation world-values-through-a-port" },
    { name: "a dependency record", record: DEPENDENCY, text: "dependency-record zod" },
    { name: "debt on one check", record: CAST_DEBT, text: "debt" },
    { name: "an authorised location naming a check its symptom does not have", record: UNKNOWN_CHECK_LOCATION, text: 'authorised-location note: the catalogue has no check "cast-old" of claimed-type' },
  ])("names $name by its kind, beside the finding it answers", ({ record, text }) => {
    expect(recordReferenceText({ record })).toBe(text);
  });
});

const PLACE = { file: AUTHORISED_FILE, index: 2 };

describe("refusedLines", () => {
  it.each<{ readonly name: string; readonly refusal: RecordRefusal; readonly line: string }>([
    {
      name: "a form refusal, by each issue's path and message",
      refusal: {
        kind: "form-refused",
        issues: [
          { code: "invalid_type", expected: "string", path: ["file"], message: "Invalid input: expected string, received number", input: 3 },
          { code: "unrecognized_keys", keys: ["kind"], path: [], message: 'Unrecognized key: "kind"', input: {} },
        ],
      },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] form-refused file: Invalid input: expected string, received number; record: Unrecognized key: "kind"',
    },
    { name: "an unknown symptom", refusal: { kind: "unknown-symptom", symptom: "claimed type" }, line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-symptom "claimed type"' },
    {
      name: "debt naming a check its symptom does not have",
      refusal: { kind: "unknown-check", symptom: "claimed-type", check: "cast-old" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-check "cast-old" of claimed-type',
    },
    { name: "an unknown recipe", refusal: { kind: "unknown-recipe", recipe: "stub-with-vi-fn" }, line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-recipe "stub-with-vi-fn"' },
    {
      name: "a recipe reason in other words than the catalogue's",
      refusal: { kind: "recipe-reason-not-the-catalogues", recipe: WORLD_VALUES_THROUGH_A_PORT, recipeReason: "ports" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] recipe-reason-not-the-catalogues world-values-through-a-port: the catalogue gives its reason as "the world reaches a unit through a port"',
    },
    { name: "a named ban", refusal: { kind: "named-ban", dependency: "lodash" }, line: "hone-records/authorised-locations/claimed-type.json records[2] named-ban lodash" },
    {
      name: "an unknown runtime facility",
      refusal: { kind: "unknown-runtime-facility", outsideParty: "runtime:env" },
      line: "hone-records/authorised-locations/claimed-type.json records[2] unknown-runtime-facility runtime:env",
    },
    {
      name: "a misplaced record, by the file it belongs in",
      refusal: { kind: "misplaced", belongsIn: repoPathSchema.parse("hone-records/authorised-locations/date-used-directly.json") },
      line: "hone-records/authorised-locations/claimed-type.json records[2] misplaced hone-records/authorised-locations/date-used-directly.json",
    },
    { name: "a name that names no records file", refusal: { kind: "not-a-records-name", name: "../x" }, line: 'hone-records/authorised-locations/claimed-type.json records[2] not-a-records-name "../x"' },
    { name: "a carried record changed since the base", refusal: { kind: "carried-changed-since-base" }, line: "hone-records/authorised-locations/claimed-type.json records[2] carried-changed-since-base" },
    {
      name: "a duplicate, by the record it repeats",
      refusal: { kind: "duplicate", of: { file: AUTHORISED_FILE, index: 0 } },
      line: "hone-records/authorised-locations/claimed-type.json records[2] duplicate of hone-records/authorised-locations/claimed-type.json records[0]",
    },
  ])("prints $name", ({ refusal, line }) => {
    expect(refusedLines({ refused: { place: PLACE, refusals: [refusal] } })).toEqual([line]);
  });

  it("prints one line for each refusal of one record, in the order they were found", () => {
    expect(refusedLines({ refused: { place: PLACE, refusals: [{ kind: "unknown-symptom", symptom: "x" }, { kind: "carried-changed-since-base" }] } })).toEqual([
      'hone-records/authorised-locations/claimed-type.json records[2] unknown-symptom "x"',
      "hone-records/authorised-locations/claimed-type.json records[2] carried-changed-since-base",
    ]);
  });

  it("prints a line break inside a refusal's text as \\n, so the refusal stays on one line", () => {
    expect(refusedLines({ refused: { place: PLACE, refusals: [{ kind: "unknown-symptom", symptom: "claimed\ntype" }] } })).toEqual([
      'hone-records/authorised-locations/claimed-type.json records[2] unknown-symptom "claimed\\ntype"',
    ]);
  });
});

describe("recordNoteLine", () => {
  it.each<{ readonly name: string; readonly note: CatalogueNote; readonly line: string }>([
    {
      name: "a check its symptom does not have",
      note: { kind: "unknown-check", symptom: CLAIMED_TYPE, check: "cast-old" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-check: the catalogue has no check "cast-old" of claimed-type',
    },
    {
      name: "a case the catalogue does not hold",
      note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-case: the catalogue has no case "parses a webhook", owing "declared-not-asserted"',
    },
    {
      name: "an owes its case does not owe",
      note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] owes-not-owed: gives-a-value-its-type does not owe "written-out-answers"',
    },
  ])("names the record by its place, then the note's kind and words, for $name", ({ note, line }) => {
    expect(recordNoteLine({ recordNote: { place: PLACE, note } })).toBe(line);
  });
});

describe("carriedLine", () => {
  it("names a carried record, its standing and what it lacks", () => {
    expect(carriedLine({ listing: { place: PLACE, lacks: ["case", "owes", "whyChain"], standing: "unjudged" } })).toBe(
      "hone-records/authorised-locations/claimed-type.json records[2] unjudged lacks case, owes, whyChain",
    );
  });

  it("names a carried record that lacks nothing by its standing alone", () => {
    expect(carriedLine({ listing: { place: { file: BOUNDARIES_FILE, index: 0 }, lacks: [], standing: "established" } })).toBe("hone-records/boundary-records.json records[0] established");
  });
});
