import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { HoneRecord } from "../hone-records/hone-record.ts";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import { holdsAt, type Site } from "./record-reach.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";

const AUDIT = "audit" as const;

const ESLINT = "eslint" as const;

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

const SRC_A = repoPathSchema.parse("src/a.ts");

const WRITTEN_DEBT: HoneRecord = {
  kind: "debt",
  symptom: LOOP_KEYWORD_LOOPS.symptom,
  reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS },
  file: SRC_A,
  note: "legacy loop",
  holding: { held: "stated" },
};

const siteWith = (request: { readonly party: Site["party"] }): Site => ({
  symptom: LOOP_KEYWORD_LOOPS.symptom,
  check: { found: "check", check: LOOP_KEYWORD_LOOPS },
  file: SRC_A,
  party: request.party,
});

describe("a debt the upgrade writes, which names no outside party", () => {
  it("still holds a site whose party the run reports as a specifier", () => {
    expect(holdsAt({ record: WRITTEN_DEBT, site: siteWith({ party: { reported: "specifier", specifier: "lodash" } }), catalogue: SETTINGS_CATALOGUE })).toBe("holds");
  });

  it("holds a site whose party is not reported", () => {
    expect(holdsAt({ record: WRITTEN_DEBT, site: siteWith({ party: { reported: "not-reported" } }), catalogue: SETTINGS_CATALOGUE })).toBe("holds");
  });
});
