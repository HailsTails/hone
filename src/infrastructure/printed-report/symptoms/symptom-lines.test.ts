import { describe, expect, it } from "vitest";

import type { CheckFinding } from "../../../domain/finding/governance.ts";
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
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { findingSymptomsOf, symptomLine } from "./symptom-lines.ts";

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const SYMPTOM_PAGE = "node_modules/@hailstails/hone/rules/typescript/symptoms.md";

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
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = {
  name: "assert-to-narrow",
  title: "Assert to narrow",
  standing: "accepted",
  reason: { text: "it narrows the type", standing: "accepted" },
};

const ITEACH_OVER_TYPED_ROWS: Recipe = {
  name: "iteach-over-typed-rows",
  title: "it.each over typed rows",
  standing: "accepted",
  reason: { text: "each row is a case", standing: "accepted" },
};

const BOUNDARY_RECORD_KIND: RecordKind = {
  name: "boundary-record",
  title: "Boundary record",
  phrase: "a boundary record",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

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
  correctUses: [
    { situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" },
  ],
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
  breachUsuallySits:
    "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
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
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
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
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
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
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ section: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE = repoPathOf("src/orders/charge-order.ts");

const CLOCK_FINDING: CheckFinding = {
  check: "date-used-directly#clock-sources",
  mechanism: AUDIT,
  file: FILE,
  anchor: { line: 14, column: 0 },
  snippet: "clock.now()",
};

const BRANCH_FINDING: CheckFinding = {
  check: "branch-in-a-test#test-body",
  mechanism: AUDIT,
  file: FILE,
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {",
  remedy: { fix: "write one test per case", page: CHECKS_PAGE, section: "branching-with-if" },
};

const TEAM_FINDING: CheckFinding = {
  check: "outside-import-past-a-boundary#moment",
  mechanism: ESLINT,
  file: FILE,
  anchor: { line: 1, column: 0 },
  snippet: "moment()",
};

describe("symptomLine", () => {
  it("names a symptom's title, what it may indicate, where the breach sits, its recipe, each correct use, known debt and its page", () => {
    expect(
      symptomLine({ catalogue: REPORT_CATALOGUE, symptom: DATE_USED_DIRECTLY, page: SYMPTOM_PAGE }),
    ).toBe(
      `date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter. Known debt: debt. Read ${SYMPTOM_PAGE}#date-used-directly`,
    );
  });

  it("names several recipes, and only known debt when the symptom has no correct use", () => {
    expect(
      symptomLine({ catalogue: REPORT_CATALOGUE, symptom: BRANCH_IN_A_TEST, page: SYMPTOM_PAGE }),
    ).toBe(
      `branch-in-a-test: Branch in a test. May indicate: checks a value that may be one of several outcomes → Straight-through tests, No hidden effects. The breach usually sits in the unit's output type, where optional or loose shapes force the test to branch. Recipes: Assert to narrow; it.each over typed rows. Known debt: debt. Read ${SYMPTOM_PAGE}#branch-in-a-test`,
    );
  });

  it("names no recipe when the symptom has none, and an indication's situation after its case", () => {
    expect(
      symptomLine({ catalogue: REPORT_CATALOGUE, symptom: CLAIMED_TYPE, page: SYMPTOM_PAGE }),
    ).toBe(
      `claimed-type: Claimed type. May indicate: gives a value its type: or needs it narrower → Declared, not asserted. The breach usually sits at the producer. A schema proves the type: an authorised location. Known debt: debt. Read ${SYMPTOM_PAGE}#claimed-type`,
    );
  });
});

describe("findingSymptomsOf", () => {
  it("names each symptom the findings were seen as, once, in the order the findings first name them", () => {
    expect(
      findingSymptomsOf({
        catalogue: REPORT_CATALOGUE,
        findings: [BRANCH_FINDING, CLOCK_FINDING, BRANCH_FINDING],
      }),
    ).toEqual([BRANCH_IN_A_TEST, DATE_USED_DIRECTLY]);
  });

  it("names no symptom for a finding the catalogue has no check for", () => {
    expect(findingSymptomsOf({ catalogue: REPORT_CATALOGUE, findings: [TEAM_FINDING] })).toEqual(
      [],
    );
  });
});
