import { describe, expect, it } from "vitest";
import type { Finding } from "../finding/governance.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import {
  type Case,
  type Principle,
  type Recipe,
  type RecordKind,
  type Rule,
  type Symptom,
  type SymptomCatalogue,
  type SymptomReading,
  indicatedNamesOf,
  symptomReadingOf,
} from "./symptom-catalogue.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const STRAIGHT_THROUGH_TESTS: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: { name: "tests-are-ours", title: "Tests are ours" },
  standing: "accepted",
};

const CHECKS_A_VALUE: Case = {
  name: "checks-a-value-that-may-be-one-of-several-outcomes",
  title: "Checks a value that may be one of several outcomes",
  standing: "accepted",
  owes: [{ kind: "rule", rule: STRAIGHT_THROUGH_TESTS }],
};

const MAKES_A_NEW_VALUE: Case = {
  name: "makes-a-new-value-from-what-it-has",
  title: "Makes a new value from what it has",
  standing: "accepted",
  owes: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
};

const SENDS_DATA_OUT: Case = {
  name: "sends-data-out-of-the-program",
  title: "Sends data out of the program",
  standing: "accepted",
  owes: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
};

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted", reason: { text: "\"it narrows the type\"", standing: "accepted" } };

const RESULT_UNION: Recipe = { name: "result-union", title: "Result union", standing: "accepted", reason: { text: "\"it makes the output clear\"", standing: "accepted" } };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const BRANCH_IN_A_TEST: Symptom = {
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "`if` in a test file.",
  mayIndicate: [{ case: CHECKS_A_VALUE, points: [{ kind: "rule", rule: STRAIGHT_THROUGH_TESTS }] }],
  breachUsuallySits: "in the unit's output type",
  recipes: [ASSERT_TO_NARROW],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "A `let` assigned again.",
  mayIndicate: [{ case: MAKES_A_NEW_VALUE, points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] }],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [STRAIGHT_THROUGH_TESTS],
  cases: [CHECKS_A_VALUE, MAKES_A_NEW_VALUE],
  recipes: [ASSERT_TO_NARROW, RESULT_UNION],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [],
  symptoms: [BRANCH_IN_A_TEST, REBINDING],
  clauses: [
    { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"), sight: { kind: "one-symptom", symptom: REBINDING } },
    {
      clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "branching-with-if", symptom: BRANCH_IN_A_TEST },
          { section: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: clauseAddressSchema.parse("CD-9#result-failures"), sight: { kind: "method", recipe: RESULT_UNION, outcomeSeenBy: [REBINDING] } },
    { clause: clauseAddressSchema.parse("CD-32#pii-redaction"), sight: { kind: "outside-the-cases" } },
  ],
  checks: [],
  namedBans: [],
};

type ReadingRow = {
  readonly name: string;
  readonly finding: Pick<Finding, "clause" | "remedy">;
  readonly reading: SymptomReading;
};

describe("symptomReadingOf", () => {
  it.each<ReadingRow>([
    {
      name: "names the one symptom a clause sees",
      finding: { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment") },
      reading: { reading: "named", symptom: REBINDING },
    },
    {
      name: "names the symptom of the form a by-form clause's finding gives as its section",
      finding: {
        clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
        remedy: { fix: "write one test per case", page: "CHECKS.md", section: "branching-with-if" },
      },
      reading: { reading: "named", symptom: BRANCH_IN_A_TEST },
    },
    {
      name: "names another form's symptom for another section of the same clause",
      finding: { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), remedy: { fix: "write the values out", page: "CHECKS.md", section: "a-let" } },
      reading: { reading: "named", symptom: REBINDING },
    },
    {
      name: "is not in the catalogue for a by-form clause's section the catalogue does not list",
      finding: { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), remedy: { fix: "write it out", page: "CHECKS.md", section: "a-new-form" } },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "is not in the catalogue for a by-form clause's finding with no section",
      finding: { clause: clauseAddressSchema.parse("CD-27#test-body-logic") },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "sees no symptom for a clause that demands a method",
      finding: { clause: clauseAddressSchema.parse("CD-9#result-failures") },
      reading: { reading: "sees-no-symptom" },
    },
    {
      name: "sees no symptom for a clause outside the cases",
      finding: { clause: clauseAddressSchema.parse("CD-32#pii-redaction") },
      reading: { reading: "sees-no-symptom" },
    },
    {
      name: "is not in the catalogue for a clause the catalogue does not list",
      finding: { clause: clauseAddressSchema.parse("CD-17#clock-sources") },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "is not in the catalogue for the same clause in a team's rule set",
      finding: { clause: clauseAddressSchema.parse("team/CD-44#parameter-reassignment") },
      reading: { reading: "not-in-catalogue" },
    },
  ])("$name", ({ finding, reading }) => {
    expect(symptomReadingOf({ catalogue: CATALOGUE, finding })).toEqual(reading);
  });
});

describe("indicatedNamesOf", () => {
  it("names each rule and principle the symptom may indicate once, in the order its cases first point at them", () => {
    expect(
      indicatedNamesOf({
        symptom: {
          ...REBINDING,
          mayIndicate: [
            { case: MAKES_A_NEW_VALUE, points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] },
            { case: CHECKS_A_VALUE, points: [{ kind: "rule", rule: STRAIGHT_THROUGH_TESTS }] },
            { case: SENDS_DATA_OUT, points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] },
          ],
        },
      }),
    ).toEqual(["no-hidden-effects", "straight-through-tests"]);
  });
});
