import { describe, expect, it } from "vitest";

import type {
  Case,
  Check,
  Engine,
  Pointed,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { resolveObservedCheck, type FindingCheck } from "./finding-check.ts";
import type { CheckFinding } from "./governance.ts";

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const CHECKS_PAGE = "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md";

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = {
  name: "external-behaviour-sits-at-a-boundary",
  title: "External behaviour sits at a boundary",
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const PORTS_DECLARED_INSIDE: Rule = {
  name: "ports-declared-inside",
  title: "Ports declared inside",
  principle: AT_A_BOUNDARY,
  standing: "accepted",
};

const WRITTEN_OUT_ANSWERS: Rule = {
  name: "written-out-answers",
  title: "Written-out answers",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DOER_OR_ORCHESTRATOR: Rule = {
  name: "doer-or-orchestrator",
  title: "Doer or orchestrator",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = {
  name: "does-one-job",
  title: "Does one job",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

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
  ruleSet: TOOL_RULE_SET,
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "assert-to-narrow",
  title: "Assert to narrow",
  standing: "accepted",
  reason: { text: "it narrows the type", standing: "accepted" },
};

const IT_EACH_OVER_TYPED_ROWS: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "it-each-over-typed-rows",
  title: "it.each over typed rows",
  standing: "accepted",
  reason: { text: "each row is a case", standing: "accepted" },
};

const DEBT_KIND: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DATE_USED_DIRECTLY: Symptom = {
  ruleSet: TOOL_RULE_SET,
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
  correctUses: [
    {
      situation: "correct use",
      kind: AUTHORISED_LOCATION_KIND,
      at: "on the clock adapter",
      binding: "check-and-file",
    },
  ],
};

const BRANCH_IN_A_TEST: Symptom = {
  ruleSet: TOOL_RULE_SET,
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
  breachUsuallySits:
    "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, IT_EACH_OVER_TYPED_ROWS],
  correctUses: [],
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
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    {
      situation: "a schema proves the type",
      kind: AUTHORISED_LOCATION_KIND,
      binding: "check-and-file",
    },
  ],
};

const CLOCK_SOURCES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-17"),
  clause: clauseIdOf("clock-sources"),
};

const TEST_BODY_LOGIC = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const CAST_EXPRESSIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const CLOCK_CHECK: Check = {
  name: "clock-sources",
  symptom: DATE_USED_DIRECTLY,
  page: "date-used-directly/clock-sources.md",
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
  findingSpecifics: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  page: "branch-in-a-test/test-body.md",
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
  findingSpecifics: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [
    PORTS_DECLARED_INSIDE,
    WRITTEN_OUT_ANSWERS,
    DOER_OR_ORCHESTRATOR,
    STRAIGHT_THROUGH_TESTS,
    DECLARED_NOT_ASSERTED,
  ],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, IT_EACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ form: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE = repoPathOf("src/orders/charge-order.ts");

const findingOf = (
  request: Pick<CheckFinding, "check" | "mechanism" | "remedy">,
): CheckFinding => ({
  ruleSet: TOOL_RULE_SET,
  file: FILE,
  anchor: { line: 3, column: 4 },
  snippet: "snippet",
  ...request,
});

const ANGLE_BRACKETS_CHECK: Check = {
  name: "angle-brackets",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/angle-brackets.md",
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const TWO_CAST_CHECKS: SymptomCatalogue = {
  ...REPORT_CATALOGUE,
  checks: [...REPORT_CATALOGUE.checks, ANGLE_BRACKETS_CHECK],
};

const BRANCH_REMEDY: CheckFinding["remedy"] = {
  fix: "write one test per case",
  form: "branching-with-if",
};

type Row = {
  readonly name: string;
  readonly catalogue: SymptomCatalogue;
  readonly finding: CheckFinding;
  readonly resolved: FindingCheck;
};

describe("resolveObservedCheck", () => {
  it.each<Row>([
    {
      name: "a finding naming a check its engine measures resolves to that check",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({
        mechanism: ESLINT,
        check: "claimed-type#cast-expressions",
      }),
      resolved: { resolved: "check", check: CAST_CHECK, engine: ESLINT_ENGINE },
    },
    {
      name: "a finding naming one of two checks of a symptom resolves to the one it names",
      catalogue: TWO_CAST_CHECKS,
      finding: findingOf({
        mechanism: ESLINT,
        check: "claimed-type#angle-brackets",
      }),
      resolved: { resolved: "check", check: ANGLE_BRACKETS_CHECK, engine: ESLINT_ENGINE },
    },
    {
      name: "a finding naming a check its engine does not measure resolves to nothing",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({
        mechanism: AUDIT,
        check: "claimed-type#cast-expressions",
      }),
      resolved: { resolved: "none" },
    },
    {
      name: "a finding naming an unregistered check resolves to nothing",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({
        mechanism: ESLINT,
        check: "claimed-type#loops",
      }),
      resolved: { resolved: "none" },
    },
    {
      name: "a Walker finding with a named check resolves to its catalogue entry",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({ check: "date-used-directly#clock-sources", mechanism: AUDIT }),
      resolved: { resolved: "check", check: CLOCK_CHECK, engine: WALKER },
    },
    {
      name: "a finding with a remedy resolves by its check address",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({
        check: "branch-in-a-test#test-body",
        mechanism: AUDIT,
        remedy: BRANCH_REMEDY,
      }),
      resolved: { resolved: "check", check: TEST_BODY_CHECK, engine: WALKER },
    },
    {
      name: "a finding naming a missing check for a known symptom resolves to nothing",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({ check: "branch-in-a-test#missing", mechanism: AUDIT }),
      resolved: { resolved: "none" },
    },
    {
      name: "a finding from the wrong engine does not resolve by its symptom alone",
      catalogue: REPORT_CATALOGUE,
      finding: findingOf({ check: "date-used-directly#clock-sources", mechanism: ESLINT }),
      resolved: { resolved: "none" },
    },
    {
      name: "a missing check does not resolve to another check of the same symptom",
      catalogue: TWO_CAST_CHECKS,
      finding: findingOf({ check: "claimed-type#unknown", mechanism: ESLINT }),
      resolved: { resolved: "none" },
    },
  ])("$name", ({ catalogue, finding, resolved }) => {
    expect(resolveObservedCheck({ catalogue, observation: finding })).toEqual(resolved);
  });
});
