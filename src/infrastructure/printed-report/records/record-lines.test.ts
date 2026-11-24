import { describe, expect, it } from "vitest";

import type {
  Case,
  Check,
  Pointed,
  Recipe,
  Rule,
  Symptom,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  CatalogueNote,
  HoneRecord,
  RecordRefusal,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { WhyChain } from "../../../domain/records/why-chain.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import {
  carriedLine,
  recordNoteLine,
  recordPlaceText,
  recordReferenceText,
  recordSubjectText,
  refusedLines,
} from "./record-lines.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: { name: "one-place-decides", title: "One place decides" },
  standing: "accepted",
};

const OWED_DECLARED_NOT_ASSERTED: Pointed = { kind: "rule", rule: DECLARED_NOT_ASSERTED };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [OWED_DECLARED_NOT_ASSERTED],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: GIVES_A_VALUE_ITS_TYPE,
      situation: "or needs it narrower",
      points: [OWED_DECLARED_NOT_ASSERTED],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    {
      situation: "a schema proves the type",
      kind: {
        name: "authorised-location",
        title: "Authorised location",
        phrase: "an authorised location",
        todaysFormat: "authorised-location",
      },
    },
  ],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [{ name: "eslint" }],
  forms: [],
};

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const BOUNDARIES_FILE = repoPathOf("hone-records/boundary-records.json");

const CLOCK_ADAPTER = repoPathOf("src/adapters/system-clock.ts");

const STATED_DEBT: HoneRecord = {
  kind: "debt",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: { held: "stated" },
};

const CARRIED_DEBT: HoneRecord = {
  kind: "debt",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: { held: "carried", entry: {}, lacks: [], standing: "established" },
};

const MATCHED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: {
    held: "stated",
    owing: {
      matches: "the-catalogue",
      case: GIVES_A_VALUE_ITS_TYPE,
      owes: OWED_DECLARED_NOT_ASSERTED,
    },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const UNKNOWN_CASE_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: {
    held: "stated",
    owing: {
      matches: "not-the-catalogue",
      note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" },
    },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const UNOWED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: {
    held: "stated",
    owing: {
      matches: "not-the-catalogue",
      note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written out answers" },
    },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const CARRIED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: FILE,
  holding: {
    held: "carried",
    entry: {},
    lacks: ["case", "owes", "whyChain"],
    standing: "unjudged",
  },
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
  module: repoPathOf("src/adapters/files"),
  outsideParty: { kind: "scheme-module", specifier: "node:fs" },
  holding: { held: "carried", entry: {}, lacks: ["ports"], standing: "established" },
};

const UUID_BOUNDARY: HoneRecord = {
  kind: "boundary-record",
  module: repoPathOf("src/adapters/ids"),
  outsideParty: { kind: "package", specifier: "uuid/v4", dependency: "uuid" },
  holding: { held: "stated", ports: ["Ids"] },
};

const DEPENDENCY: HoneRecord = {
  kind: "dependency-record",
  dependency: "zod",
  nativeWay: "hand-written parsing",
  whyNotEnough: "Not enough.",
};

const CAST_DEBT: HoneRecord = {
  kind: "debt",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "one-check", check: CAST_CHECK },
  file: FILE,
  holding: { held: "stated" },
};

const UNKNOWN_CHECK_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "unknown-check", check: "cast-old" },
  file: FILE,
  holding: {
    held: "stated",
    owing: {
      matches: "the-catalogue",
      case: GIVES_A_VALUE_ITS_TYPE,
      owes: OWED_DECLARED_NOT_ASSERTED,
    },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const CARRIED_UNKNOWN_CHECK_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "unknown-check", check: "cast-old" },
  file: FILE,
  holding: {
    held: "carried",
    entry: {},
    lacks: ["case", "owes", "whyChain"],
    standing: "unjudged",
  },
};

describe("recordPlaceText", () => {
  it("names a record by its records file and its index in that file's records", () => {
    expect(recordPlaceText({ place: { file: DEBT_FILE, index: 3 } })).toBe(
      "hone-records/debt/claimed-type.json records[3]",
    );
  });

  it.each([
    {
      name: "a space",
      file: repoPathOf("hone-records/debt/claimed type.json"),
      text: '"hone-records/debt/claimed type.json" records[3]',
    },
    {
      name: "a double quote",
      file: repoPathOf('hone-records/debt/claimed"type.json'),
      text: '"hone-records/debt/claimed\\"type.json" records[3]',
    },
  ])(
    "writes a records file whose name holds $name as a JSON string, so the file is always one field",
    ({ file, text }) => {
      expect(recordPlaceText({ place: { file, index: 3 } })).toBe(text);
    },
  );
});

describe("recordSubjectText", () => {
  it.each([
    { name: "debt", record: STATED_DEBT, text: "claimed-type debt src/adapters/stripe-webhook.ts" },
    {
      name: "carried debt",
      record: CARRIED_DEBT,
      text: "claimed-type debt src/adapters/stripe-webhook.ts carried",
    },
    {
      name: "an authorised location that matches the catalogue",
      record: MATCHED_LOCATION,
      text: "claimed-type authorised-location src/adapters/stripe-webhook.ts",
    },
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
    {
      name: "a carried authorised location",
      record: CARRIED_LOCATION,
      text: "claimed-type authorised-location src/adapters/stripe-webhook.ts carried",
    },
    {
      name: "a deviation",
      record: DEVIATION,
      text: "world-values-through-a-port deviation src/adapters/stripe-webhook.ts",
    },
    {
      name: "a boundary record on a runtime facility",
      record: CLOCK_BOUNDARY,
      text: "runtime:clock boundary-record src/adapters/system-clock.ts",
    },
    {
      name: "a carried boundary record on a scheme module",
      record: FS_BOUNDARY,
      text: "node:fs boundary-record src/adapters/files carried",
    },
    {
      name: "a boundary record on a package subpath",
      record: UUID_BOUNDARY,
      text: "uuid/v4 boundary-record src/adapters/ids",
    },
    { name: "a dependency record", record: DEPENDENCY, text: "zod dependency-record" },
    {
      name: "debt on one check",
      record: CAST_DEBT,
      text: "claimed-type#cast-expressions debt src/adapters/stripe-webhook.ts",
    },
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
    {
      name: "a matching authorised location",
      record: MATCHED_LOCATION,
      text: "authorised-location",
    },
    {
      name: "an authorised location with a note",
      record: UNOWED_LOCATION,
      text: 'authorised-location note: gives-a-value-its-type does not owe "written out answers"',
    },
    { name: "a boundary record", record: CLOCK_BOUNDARY, text: "boundary-record runtime:clock" },
    { name: "a deviation", record: DEVIATION, text: "deviation world-values-through-a-port" },
    { name: "a dependency record", record: DEPENDENCY, text: "dependency-record zod" },
    { name: "debt on one check", record: CAST_DEBT, text: "debt" },
    {
      name: "an authorised location naming a check its symptom does not have",
      record: UNKNOWN_CHECK_LOCATION,
      text: 'authorised-location note: the catalogue has no check "cast-old" of claimed-type',
    },
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
          { path: ["file"], message: "Invalid input: expected string, received number" },
          { path: [], message: 'Unrecognized key: "kind"' },
        ],
      },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] form-refused file: Invalid input: expected string, received number; record: Unrecognized key: "kind"',
    },
    {
      name: "an unknown symptom",
      refusal: { kind: "unknown-symptom", symptom: "claimed type" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-symptom "claimed type"',
    },
    {
      name: "debt naming a check its symptom does not have",
      refusal: { kind: "unknown-check", symptom: "claimed-type", check: "cast-old" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-check "cast-old" of claimed-type',
    },
    {
      name: "an unknown recipe",
      refusal: { kind: "unknown-recipe", recipe: "stub-with-vi-fn" },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] unknown-recipe "stub-with-vi-fn"',
    },
    {
      name: "a recipe reason in other words than the catalogue's",
      refusal: {
        kind: "recipe-reason-not-the-catalogues",
        recipe: WORLD_VALUES_THROUGH_A_PORT,
        recipeReason: "ports",
      },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] recipe-reason-not-the-catalogues world-values-through-a-port: the catalogue gives its reason as "the world reaches a unit through a port"',
    },
    {
      name: "a named ban",
      refusal: { kind: "named-ban", dependency: "lodash" },
      line: "hone-records/authorised-locations/claimed-type.json records[2] named-ban lodash",
    },
    {
      name: "an unknown runtime facility",
      refusal: { kind: "unknown-runtime-facility", outsideParty: "runtime:env" },
      line: "hone-records/authorised-locations/claimed-type.json records[2] unknown-runtime-facility runtime:env",
    },
    {
      name: "a misplaced record, by the file it belongs in",
      refusal: {
        kind: "misplaced",
        belongsIn: repoPathOf("hone-records/authorised-locations/date-used-directly.json"),
      },
      line: "hone-records/authorised-locations/claimed-type.json records[2] misplaced hone-records/authorised-locations/date-used-directly.json",
    },
    {
      name: "a name that names no records file",
      refusal: {
        kind: "not-a-records-name",
        folder: repoPathOf("hone-records/authorised-locations"),
        name: "../x",
      },
      line: 'hone-records/authorised-locations/claimed-type.json records[2] not-a-records-name hone-records/authorised-locations "../x"',
    },
    {
      name: "a carried record changed since the base",
      refusal: { kind: "carried-changed-since-base" },
      line: "hone-records/authorised-locations/claimed-type.json records[2] carried-changed-since-base",
    },
    {
      name: "a record held at a path git saw moved, by the path to repoint it to",
      refusal: { kind: "held-at-moved-path", movedTo: repoPathOf("src/cart/cart.ts") },
      line: "hone-records/authorised-locations/claimed-type.json records[2] held-at-moved-path src/cart/cart.ts: git moved its file there; run record-debt to repoint it",
    },
    {
      name: "a duplicate, by the record it repeats",
      refusal: { kind: "duplicate", of: { file: AUTHORISED_FILE, index: 0 } },
      line: "hone-records/authorised-locations/claimed-type.json records[2] duplicate of hone-records/authorised-locations/claimed-type.json records[0]",
    },
  ])("prints $name", ({ refusal, line }) => {
    expect(refusedLines({ refused: { place: PLACE, refusals: [refusal] } })).toEqual([line]);
  });

  it("prints one line for each refusal of one record, in the order they were found", () => {
    expect(
      refusedLines({
        refused: {
          place: PLACE,
          refusals: [
            { kind: "unknown-symptom", symptom: "x" },
            { kind: "carried-changed-since-base" },
          ],
        },
      }),
    ).toEqual([
      'hone-records/authorised-locations/claimed-type.json records[2] unknown-symptom "x"',
      "hone-records/authorised-locations/claimed-type.json records[2] carried-changed-since-base",
    ]);
  });

  it("prints a line break inside a refusal's text as \\n, so the refusal stays on one line", () => {
    expect(
      refusedLines({
        refused: {
          place: PLACE,
          refusals: [{ kind: "unknown-symptom", symptom: "claimed\ntype" }],
        },
      }),
    ).toEqual([
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
  ])(
    "names the record by its place, then the note's kind and words, for $name",
    ({ note, line }) => {
      expect(recordNoteLine({ recordNote: { place: PLACE, note } })).toBe(line);
    },
  );
});

describe("carriedLine", () => {
  it("names a carried record, its standing and what it lacks", () => {
    expect(
      carriedLine({
        listing: { place: PLACE, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
      }),
    ).toBe(
      "hone-records/authorised-locations/claimed-type.json records[2] unjudged lacks case, owes, whyChain",
    );
  });

  it("names a carried record that lacks nothing by its standing alone", () => {
    expect(
      carriedLine({
        listing: { place: { file: BOUNDARIES_FILE, index: 0 }, lacks: [], standing: "established" },
      }),
    ).toBe("hone-records/boundary-records.json records[0] established");
  });
});
