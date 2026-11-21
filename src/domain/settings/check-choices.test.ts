import { describe, expect, it } from "vitest";
import { type ClauseAddress, clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import { mechanismIdSchema, ruleSetNameSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { type CheckChoiceRefusal, type CheckChoices, checkChoicesOf, type RuleSetCatalogue } from "./check-choices.ts";
import type { GivenCheckSettings, ListedCheck } from "./settings-file.ts";

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

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: "hone", catalogue: SETTINGS_CATALOGUE }];

const TEAM = { name: ruleSetNameSchema.parse("team") };

const LISTED_TEST_BODY: readonly ListedCheck[] = [
  { address: { ruleSet: "hone", check: "loop-keyword#test-body" }, state: { state: "run", engine: "walker" } },
  { address: { ruleSet: "hone", check: "rebinding#test-body" }, state: { state: "run", engine: "walker" } },
];

const LISTED_LOOPS: ListedCheck = { address: { ruleSet: "hone", check: "loop-keyword#loops" }, state: { state: "not-adopted" } };

describe("checkChoicesOf", () => {
  it("chooses each clause once, run by the mechanism its listed engine stands for, with the checks that list it", () => {
    expect(checkChoicesOf({ catalogues: CATALOGUES, checks: [...LISTED_TEST_BODY, LISTED_LOOPS], checkSettings: [] })).toEqual<{
      readonly outcome: "ok";
      readonly value: CheckChoices;
    }>({
      outcome: "ok",
      value: {
        clauses: [
          {
            clause: TEST_BODY_CLAUSE,
            checks: [LISTED_TEST_BODY[0].address, LISTED_TEST_BODY[1].address],
            choice: { state: "run", mechanism: mechanismIdSchema.parse("audit"), settings: undefined },
          },
          { clause: LOOPS_CLAUSE, checks: [LISTED_LOOPS.address], choice: { state: "not-adopted" } },
        ],
        uncovered: [],
      },
    });
  });

  it("carries the settings given on a run check to its clause", () => {
    const settings: GivenCheckSettings = { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "2" } };
    expect(checkChoicesOf({ catalogues: CATALOGUES, checks: LISTED_TEST_BODY, checkSettings: [settings] })).toMatchObject({
      outcome: "ok",
      value: { clauses: [{ clause: TEST_BODY_CLAUSE, choice: { state: "run", settings } }] },
    });
  });

  it("takes the same settings given on two checks of one clause", () => {
    const settings: readonly GivenCheckSettings[] = [
      { address: { ruleSet: "hone", check: "loop-keyword#test-body" }, values: { edition: "2" } },
      { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "2" } },
    ];
    expect(checkChoicesOf({ catalogues: CATALOGUES, checks: LISTED_TEST_BODY, checkSettings: settings })).toMatchObject({
      outcome: "ok",
      value: { clauses: [{ clause: TEST_BODY_CLAUSE, choice: { state: "run", settings: settings[0] } }] },
    });
  });

  it("names as uncovered the clause of every check of a listed symptom that is listed nowhere", () => {
    expect(checkChoicesOf({ catalogues: CATALOGUES, checks: LISTED_TEST_BODY, checkSettings: [] })).toMatchObject({
      outcome: "ok",
      value: { uncovered: [LOOPS_CLAUSE] },
    });
  });

  type RefusalRow = {
    readonly name: string;
    readonly checks: readonly ListedCheck[];
    readonly checkSettings: readonly GivenCheckSettings[];
    readonly refusal: CheckChoiceRefusal;
  };

  it.each<RefusalRow>([
    {
      name: "a check no catalogue holds",
      checks: [{ address: { ruleSet: "hone", check: "loop-keyword#nowhere" }, state: { state: "run", engine: "walker" } }],
      checkSettings: [],
      refusal: { kind: "unknown-check", address: "loop-keyword#nowhere" },
    },
    {
      name: "a check in a rule set with no catalogue yet",
      checks: [{ address: { ruleSet: TEAM, check: "loop-keyword#loops" }, state: { state: "run", engine: "walker" } }],
      checkSettings: [],
      refusal: { kind: "unknown-check", address: "team/loop-keyword#loops" },
    },
    {
      name: "a review-only clause listed as a check of a symptom it sees",
      checks: [{ address: { ruleSet: "hone", check: "rebinding#layering" }, state: { state: "not-run" } }],
      checkSettings: [],
      refusal: { kind: "review-only-listed", address: "rebinding#layering" },
    },
    {
      name: "a check run by an engine it does not have",
      checks: [{ address: { ruleSet: "hone", check: "loop-keyword#test-body" }, state: { state: "run", engine: "eslint" } }],
      checkSettings: [],
      refusal: { kind: "engine-not-allowed", address: "loop-keyword#test-body", engine: "eslint", engines: ["walker"] },
    },
    {
      name: "a check listed twice, once with Hone's rule set named",
      checks: [LISTED_LOOPS, { address: { ruleSet: "hone", check: "loop-keyword#loops" }, state: { state: "not-run" } }],
      checkSettings: [],
      refusal: { kind: "duplicate-check", key: "checks", address: "loop-keyword#loops", prefixedAddress: "hone/loop-keyword#loops" },
    },
    {
      name: "a check that runs with another left unlisted",
      checks: [LISTED_TEST_BODY[0]],
      checkSettings: [],
      refusal: { kind: "checks-run-together", address: "loop-keyword#test-body", others: ["rebinding#test-body"] },
    },
    {
      name: "two checks that run together listed in different states",
      checks: [LISTED_TEST_BODY[0], { address: { ruleSet: "hone", check: "rebinding#test-body" }, state: { state: "not-run" } }],
      checkSettings: [],
      refusal: { kind: "checks-run-together", address: "loop-keyword#test-body", others: ["rebinding#test-body"] },
    },
    {
      name: "settings on a check that is not adopted",
      checks: [LISTED_LOOPS],
      checkSettings: [{ address: { ruleSet: "hone", check: "loop-keyword#loops" }, values: { edition: "2" } }],
      refusal: { kind: "check-settings-refused", address: "loop-keyword#loops", listing: "not-adopted" },
    },
    {
      name: "settings on a check that is not listed",
      checks: LISTED_TEST_BODY,
      checkSettings: [{ address: { ruleSet: "hone", check: "loop-keyword#loops" }, values: { edition: "2" } }],
      refusal: { kind: "check-settings-refused", address: "loop-keyword#loops", listing: "unlisted" },
    },
    {
      name: "settings on an unknown check",
      checks: LISTED_TEST_BODY,
      checkSettings: [{ address: { ruleSet: "hone", check: "loop-keyword#nowhere" }, values: { edition: "2" } }],
      refusal: { kind: "unknown-check", address: "loop-keyword#nowhere" },
    },
    {
      name: "settings given twice for one check",
      checks: LISTED_TEST_BODY,
      checkSettings: [
        { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "2" } },
        { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "1" } },
      ],
      refusal: { kind: "duplicate-check", key: "checkSettings", address: "rebinding#test-body", prefixedAddress: "hone/rebinding#test-body" },
    },
    {
      name: "different settings on two checks that run together",
      checks: LISTED_TEST_BODY,
      checkSettings: [
        { address: { ruleSet: "hone", check: "loop-keyword#test-body" }, values: { edition: "2" } },
        { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "1" } },
      ],
      refusal: { kind: "check-settings-differ", address: "rebinding#test-body", other: "loop-keyword#test-body" },
    },
  ])("refuses $name", ({ checks, checkSettings, refusal }) => {
    expect(checkChoicesOf({ catalogues: CATALOGUES, checks, checkSettings })).toEqual({ outcome: "failed", error: refusal });
  });
});
