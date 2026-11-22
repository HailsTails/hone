import { describe, expect, it } from "vitest";
import type { AttributedNativeException, Finding } from "../../../domain/finding/governance.ts";
import type { PlacedRecord, SymptomReach } from "../../../domain/records/hone-records/hone-record.ts";
import type { Case, Check, Engine, Pointed, Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { answeredLine, checkLine, editionLine, findingLine, notRunLine, unrecordedLines } from "./finding-lines.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "audit" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const CHECKS_PAGE = "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md";

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" };

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: AT_A_BOUNDARY, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const STRAIGHT_THROUGH_TESTS: Rule = { name: "straight-through-tests", title: "Straight-through tests", principle: TESTS_ARE_OURS, standing: "accepted" };

const DECLARED_NOT_ASSERTED: Rule = { name: "declared-not-asserted", title: "Declared, not asserted", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }] };

const CHECKS_A_VALUE: Case = {
  name: "checks-a-value-that-may-be-one-of-several-outcomes",
  title: "Checks a value that may be one of several outcomes",
  standing: "accepted",
  owes: [{ kind: "principle", principle: TESTS_ARE_OURS }],
};

const OWED_DECLARED_NOT_ASSERTED: Pointed = { kind: "rule", rule: DECLARED_NOT_ASSERTED };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [OWED_DECLARED_NOT_ASSERTED],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted", reason: { text: "it narrows the type", standing: "accepted" } };

const ITEACH_OVER_TYPED_ROWS: Recipe = { name: "iteach-over-typed-rows", title: "it.each over typed rows", standing: "accepted", reason: { text: "each row is a case", standing: "accepted" } };

const BOUNDARY_RECORD_KIND: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: NEEDS_THE_CURRENT_TIME,
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: DOES_ONE_JOB, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" }],
};

const BRANCH_IN_A_TEST: Symptom = {
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "`if` in a test file.",
  mayIndicate: [
    {
      case: CHECKS_A_VALUE,
      points: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "principle", principle: NO_HIDDEN_EFFECTS },
      ],
    },
  ],
  breachUsuallySits: "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [{ case: GIVES_A_VALUE_ITS_TYPE, situation: "or needs it narrower", points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }] }],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
};

const CLOCK_SOURCES = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-17"), clause: clauseIdOf("clock-sources") };

const TEST_BODY_LOGIC = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") };

const CAST_EXPRESSIONS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") };

const TEAM_CLAUSE = { ruleSet: { name: ruleSetNameOf("acme") }, discipline: disciplineIdOf("AC-1"), clause: clauseIdOf("no-moment") };

const CLOCK_CHECK: Check = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, engines: [WALKER], forms: [] };

const TEST_BODY_CHECK: Check = { name: "test-body", symptom: BRANCH_IN_A_TEST, clause: TEST_BODY_LOGIC, engines: [WALKER], forms: ["branching-with-if"] };

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    { clause: TEST_BODY_LOGIC, sight: { kind: "symptom-by-form", forms: [{ section: "branching-with-if", symptom: BRANCH_IN_A_TEST }] } },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const TEST_FILE = repoPathOf("src/orders/charge-order.test.ts");

const WEBHOOK_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const PACKAGE_FILE = repoPathOf("package.json");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "const chargedAt = clock.now();" };

const BRANCH_FINDING: Finding = {
  clause: TEST_BODY_LOGIC,
  mechanism: AUDIT,
  file: TEST_FILE,
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {\n  return;",
  remedy: { fix: "write one test per case, or one it.each table", page: CHECKS_PAGE, section: "branching-with-if" },
};

const SECOND_CAST_CHECK: Check = { name: "cast-walker", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const TEAM_FINDING: Finding = { clause: TEAM_CLAUSE, mechanism: ESLINT, file: ORDER_FILE, anchor: { line: 1, column: 0 }, snippet: "moment()" };

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: WEBHOOK_FILE, holding: { held: "stated" } },
};

const CLOCK_BOUNDARY: PlacedRecord = {
  place: { file: repoPathOf("hone-records/boundary-records.json"), index: 0 },
  record: { kind: "boundary-record", module: ORDER_FILE, outsideParty: { kind: "runtime", facility: "clock" }, holding: { held: "stated", ports: ["Clock"] } },
};

describe("findingLine", () => {
  it("leads with the check address and engine, then the place, the snippet and what the symptom may indicate", () => {
    expect(findingLine({ catalogue: REPORT_CATALOGUE, finding: CLOCK_FINDING })).toBe(
      "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
    );
  });

  it("ends with the fix and the page that shows it when the check names one, and keeps a line break in the snippet on one line", () => {
    expect(findingLine({ catalogue: REPORT_CATALOGUE, finding: BRANCH_FINDING })).toBe(
      `branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; may indicate: straight-through-tests, no-hidden-effects fix: write one test per case, or one it.each table (${CHECKS_PAGE}#branching-with-if)`,
    );
  });

  it("leads with the clause address and mechanism when the catalogue has no check for the finding, and names no symptom", () => {
    expect(findingLine({ catalogue: REPORT_CATALOGUE, finding: TEAM_FINDING })).toBe("acme/AC-1#no-moment eslint src/orders/charge-order.ts:1:0 moment()");
  });
});

describe("answeredLine", () => {
  it("names each record that answers the finding, by its kind, after the finding's place and snippet", () => {
    expect(answeredLine({ catalogue: REPORT_CATALOGUE, answered: { finding: CLOCK_FINDING, by: [DEBT, CLOCK_BOUNDARY] } })).toBe(
      "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); answered by debt answered by boundary-record runtime:clock",
    );
  });

  it("names neither the symptom's indications nor the fix", () => {
    expect(answeredLine({ catalogue: REPORT_CATALOGUE, answered: { finding: BRANCH_FINDING, by: [DEBT] } })).toBe(
      "branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; answered by debt",
    );
  });
});

describe("the lines that name a check", () => {
  it("prints an edition by its check, engine, the edition that ran and the latest", () => {
    expect(editionLine({ reading: { check: CLOCK_CHECK, engine: { name: "walker", mechanism: AUDIT }, edition: editionOf("2"), latest: editionOf("3") } })).toBe(
      "date-used-directly#clock-sources walker edition 2 of 3",
    );
  });

  it("prints a check by its address", () => {
    expect(checkLine({ check: TEST_BODY_CHECK })).toBe("branch-in-a-test#test-body");
  });

  it("prints a check that is adopted and not run as enforced by review", () => {
    expect(notRunLine({ check: TEST_BODY_CHECK })).toBe("branch-in-a-test#test-body adopted, engine not run: enforced by review");
  });
});

describe("unrecordedLines", () => {
  it.each<{ readonly name: string; readonly exception: AttributedNativeException; readonly line: string }>([
    { name: "an ignore", exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT }, line: "claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts" },
    {
      name: "a config override",
      exception: { kind: "config-override", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint config-override src/adapters/stripe-webhook.ts",
    },
    {
      name: "a suppression entry",
      exception: { kind: "suppression-entry", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, location: repoPathOf("eslint-suppressions.json"), mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint suppression-entry src/adapters/stripe-webhook.ts eslint-suppressions.json",
    },
    {
      name: "an inline disable of one rule",
      exception: { kind: "inline-disable", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 4, text: "// eslint-disable-next-line no-restricted-syntax", reach: "one-clause", mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:4 // eslint-disable-next-line no-restricted-syntax",
    },
    {
      name: "an inline disable that names no rule",
      exception: { kind: "inline-disable", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 4, text: "// eslint-disable-next-line", reach: "every-selected-clause", mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:4 // eslint-disable-next-line names no rule and escapes every selected check: naming the rule is the cheap fix",
    },
    {
      name: "an inline rule config",
      exception: { kind: "inline-rule-config", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 1, text: "/* eslint no-restricted-syntax: off */", mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint inline-rule-config src/adapters/stripe-webhook.ts:1 /* eslint no-restricted-syntax: off */",
    },
    {
      name: "a command-line option that weakens the whole run",
      exception: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "--no-inline-config", cause: { kind: "weakens-run" }, mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint command-line-option package.json lint --no-inline-config weakens the script's whole run, so no record can cover it: remove it from the script",
    },
    {
      name: "a command-line option after another command",
      exception: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: { kind: "after-another-command", command: "eslint", invocation: "eslint --rule x:off ." },
        mechanism: ESLINT,
      },
      line: 'claimed-type#cast-expressions eslint command-line-option package.json lint --rule x:off: eslint is not the first command of its script, so Hone cannot tell what the option does to the files under check; give eslint a script of its own, such as "eslint --rule x:off ."',
    },
    {
      name: "a wrapped command-line option",
      exception: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
        mechanism: ESLINT,
      },
      line: 'claimed-type#cast-expressions eslint command-line-option package.json lint --rule x:off: "env" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint',
    },
    {
      name: "a command-line option in a script Hone cannot read",
      exception: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "eslint 'x", cause: { kind: "unreadable", command: "eslint" }, mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint command-line-option package.json lint eslint 'x: a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check; pair every quote in the script",
    },
  ])("prints $name led by the check it suppresses", ({ exception, line }) => {
    expect(unrecordedLines({ catalogue: REPORT_CATALOGUE, exception })).toEqual([line]);
  });

  it("prints a suppression of a clause the catalogue has no check for, led by its clause and mechanism", () => {
    expect(unrecordedLines({ catalogue: REPORT_CATALOGUE, exception: { kind: "ignore", clause: TEAM_CLAUSE, file: ORDER_FILE, mechanism: ESLINT } })).toEqual([
      "acme/AC-1#no-moment eslint ignore src/orders/charge-order.ts",
    ]);
  });

  it("prints one line for each check of the suppressed clause on that engine", () => {
    expect(
      unrecordedLines({
        catalogue: { ...REPORT_CATALOGUE, checks: [CAST_CHECK, SECOND_CAST_CHECK] },
        exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT },
      }),
    ).toEqual(["claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts", "claimed-type#cast-walker eslint ignore src/adapters/stripe-webhook.ts"]);
  });
});
