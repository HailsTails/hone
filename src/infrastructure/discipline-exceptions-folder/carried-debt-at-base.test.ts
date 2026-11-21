import { describe, expect, it } from "vitest";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import { mechanismIdSchema } from "../hone-config-file/identifiers.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { carriedDebtDocumentsAtBaseOf } from "./carried-debt-at-base.ts";
import type { VersionOneEntry } from "./version-one-entries.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = { ...LOOP_KEYWORD, name: "rebinding", title: "Rebinding" };

const LOOPS_CLAUSE: ClauseAddress = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE: ClauseAddress = clauseAddressSchema.parse("CD-27#test-body-logic");

const LAYERING_CLAUSE: ClauseAddress = clauseAddressSchema.parse("CD-13#layering");

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT], forms: [] };

const LOOP_KEYWORD_TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const REBINDING_TEST_BODY: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER, ESLINT],
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

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

const LOOP_KEYWORD_DEBT = repoPathSchema.parse("hone-records/debt/loop-keyword.json");

const REBINDING_DEBT = repoPathSchema.parse("hone-records/debt/rebinding.json");

const CARVE_OUT: VersionOneEntry = {
  kind: "file-carve-out",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "legacy loop",
  whyChain: ["a", "b", "c", "d", "e"],
};

const TEST_BODY_CARVE_OUT: VersionOneEntry = { ...CARVE_OUT, clause: "CD-27#test-body-logic" };

const documentsAtBase = (request: { readonly entries: readonly VersionOneEntry[] }) =>
  carriedDebtDocumentsAtBaseOf({ entries: request.entries, catalogues: CATALOGUES });

describe("carriedDebtDocumentsAtBaseOf writing the debt the base's file carve-outs would have been carried as", () => {
  it("writes the debt at the one check of the clause, in that symptom's debt file, carrying the entry word for word", () => {
    expect(documentsAtBase({ entries: [CARVE_OUT] })).toEqual([
      { file: LOOP_KEYWORD_DEBT, document: { version: 2, records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: CARVE_OUT }] } },
    ]);
  });

  it("writes the debt at each check of a two-check clause, in the debt file of each check's symptom", () => {
    expect(documentsAtBase({ entries: [TEST_BODY_CARVE_OUT] })).toEqual([
      { file: LOOP_KEYWORD_DEBT, document: { version: 2, records: [{ answers: "loop-keyword#test-body", file: "src/a.ts", carried: TEST_BODY_CARVE_OUT }] } },
      { file: REBINDING_DEBT, document: { version: 2, records: [{ answers: "rebinding#test-body", file: "src/a.ts", carried: TEST_BODY_CARVE_OUT }] } },
    ]);
  });

  it("writes one document for the debts of the same symptom, in the order the entries were read", () => {
    const other: VersionOneEntry = { ...CARVE_OUT, file: "src/b.ts" };
    expect(documentsAtBase({ entries: [CARVE_OUT, other] })).toEqual([
      {
        file: LOOP_KEYWORD_DEBT,
        document: {
          version: 2,
          records: [
            { answers: "loop-keyword#loops", file: "src/a.ts", carried: CARVE_OUT },
            { answers: "loop-keyword#loops", file: "src/b.ts", carried: other },
          ],
        },
      },
    ]);
  });

  it("writes nothing for an authorised location", () => {
    expect(documentsAtBase({ entries: [{ kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" }] })).toEqual([]);
  });

  it("writes nothing for a clause-wide carve-out", () => {
    expect(documentsAtBase({ entries: [{ kind: "clause-wide-carve-out", clause: "CD-15#loops", reason: "generated", whyChain: ["a"] }] })).toEqual([]);
  });

  it("writes nothing for a carve-out whose clause has no check in the catalogue", () => {
    expect(documentsAtBase({ entries: [{ ...CARVE_OUT, clause: "CD-99#unknown" }] })).toEqual([]);
  });

  it("writes nothing for an entry whose clause or file does not parse", () => {
    expect(documentsAtBase({ entries: [{ ...CARVE_OUT, clause: "not a clause" }, { ...CARVE_OUT, file: "/absolute.ts" }] })).toEqual([]);
  });

  it("writes nothing when the base held no entries", () => {
    expect(documentsAtBase({ entries: [] })).toEqual([]);
  });
});
