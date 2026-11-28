import { describe, expect, it } from "vitest";

import type { AttributedCheckException, CheckFinding } from "../../../domain/finding/governance.ts";
import {
  createCheckPages,
  createRuleContent,
} from "../../../domain/language-layer/rule-content.ts";
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
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  PlacedRecord,
  SymptomReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import {
  answeredLine,
  checkLine,
  editionLine,
  findingLine,
  heldLine,
  notRunLine,
  unrecordedLines,
} from "./finding-lines.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const SYMPTOM_PAGE = "node_modules/@hailstails/hone/rules/typescript/symptoms.md";

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
  symptom: { ruleSet: TOOL_RULE_SET, name: "date-used-directly" },
  page: "date-used-directly/clock-sources.md",
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
  findingSpecifics: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
  page: "branch-in-a-test/test-body.md",
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
  findingSpecifics: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
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
    {
      clause: CLOCK_SOURCES,
      sight: {
        kind: "one-symptom",
        symptom: { ruleSet: TOOL_RULE_SET, name: "date-used-directly" },
      },
    },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [
          {
            form: "branching-with-if",
            symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
          },
        ],
      },
    },
    {
      clause: CAST_EXPRESSIONS,
      sight: { kind: "one-symptom", symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" } },
    },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const TEST_FILE = repoPathOf("src/orders/charge-order.test.ts");

const WEBHOOK_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const PACKAGE_FILE = repoPathOf("package.json");

const CLOCK_FINDING: CheckFinding = {
  ruleSet: TOOL_RULE_SET,
  check: "date-used-directly#clock-sources",
  mechanism: AUDIT,
  file: ORDER_FILE,
  anchor: { line: 14, column: 0 },
  snippet: "const chargedAt = clock.now();",
};

const BRANCH_FINDING: CheckFinding = {
  ruleSet: TOOL_RULE_SET,
  check: "branch-in-a-test#test-body",
  mechanism: AUDIT,
  file: TEST_FILE,
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {\n  return;",
  remedy: {
    fix: "write one test per case, or one it.each table",
    form: "branching-with-if",
  },
};

const SECOND_CAST_CHECK: Check = {
  name: "cast-walker",
  symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
  page: "claimed-type/cast-walker.md",
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const TEAM_FINDING: CheckFinding = {
  ruleSet: TOOL_RULE_SET,
  check: "outside-import-past-a-boundary#no-moment",
  mechanism: ESLINT,
  file: ORDER_FILE,
  anchor: { line: 1, column: 0 },
  snippet: "moment()",
};

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "stated" },
  },
};

const TEST_BODY_DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/branch-in-a-test.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
    reach: WHOLE_SYMPTOM,
    file: TEST_FILE,
    holding: { held: "stated" },
  },
};

const NOTED_TEST_BODY_LOCATION: PlacedRecord = {
  place: { file: repoPathOf("hone-records/authorised-locations/branch-in-a-test.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
    reach: { reaches: "unknown-check", check: "test-bodies" },
    file: TEST_FILE,
    holding: {
      binding: { binds: "check-and-file" },
      held: "carried",
      entry: {},
      lacks: ["case", "owes", "whyChain"],
      standing: "unjudged",
    },
  },
};

const CONTENT = {
  ...createRuleContent({ catalogues: [REPORT_CATALOGUE] }),
  ...createCheckPages({ catalogues: [REPORT_CATALOGUE] }),
};

const UNSITED_CONTENT = {
  ...createRuleContent({ catalogues: [{ symptoms: [] }] }),
  ...createCheckPages({ catalogues: [REPORT_CATALOGUE] }),
};

describe("findingLine", () => {
  it("leads with the check address and engine, then the place, the snippet and what the symptom may indicate", () => {
    expect(
      findingLine({
        catalogue: REPORT_CATALOGUE,
        content: CONTENT,
        finding: CLOCK_FINDING,
        symptomPage: SYMPTOM_PAGE,
      }),
    ).toBe(
      `date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); symptom: date-used-directly (${SYMPTOM_PAGE}#date-used-directly) may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator`,
    );
  });

  it("ends with the form and its check's page, then the fix, when no recipe example answers the form, and keeps a line break in the snippet on one line", () => {
    expect(
      findingLine({
        catalogue: REPORT_CATALOGUE,
        content: CONTENT,
        finding: BRANCH_FINDING,
        symptomPage: SYMPTOM_PAGE,
      }),
    ).toBe(
      `branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; symptom: branch-in-a-test (${SYMPTOM_PAGE}#branch-in-a-test) may indicate: straight-through-tests, no-hidden-effects form: branching-with-if (branch-in-a-test/test-body.md#branching-with-if) fix: write one test per case, or one it.each table`,
    );
  });

  it("names after a Hone finding's fix each Hone example of its form, and no other form's", () => {
    const narrowing: Recipe = {
      ...ASSERT_TO_NARROW,
      examples: [
        {
          anchor: "a-ternary",
          answers: [
            {
              check: {
                name: "test-body",
                symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
              },
              form: "a-ternary",
            },
          ],
        },
        {
          anchor: "an-if",
          answers: [
            {
              check: {
                name: "test-body",
                symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
              },
              form: "branching-with-if",
            },
          ],
        },
      ],
    };
    const typedRows: Recipe = {
      ...IT_EACH_OVER_TYPED_ROWS,
      examples: [
        {
          anchor: "branching",
          answers: [
            {
              check: {
                name: "test-body",
                symptom: { ruleSet: TOOL_RULE_SET, name: "branch-in-a-test" },
              },
              form: "branching-with-if",
            },
          ],
        },
      ],
    };
    const catalogue: SymptomCatalogue = {
      ...REPORT_CATALOGUE,
      checks: [{ ...TEST_BODY_CHECK, forms: ["a-ternary", "branching-with-if"] }],
      recipes: [narrowing, typedRows],
    };

    const line = findingLine({
      catalogue,
      content: {
        ...createRuleContent({ catalogues: [catalogue] }),
        ...createCheckPages({ catalogues: [catalogue] }),
      },
      finding: BRANCH_FINDING,
      symptomPage: SYMPTOM_PAGE,
    });

    expect(line).toBe(
      `branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; symptom: branch-in-a-test (${SYMPTOM_PAGE}#branch-in-a-test) may indicate: straight-through-tests, no-hidden-effects form: branching-with-if (branch-in-a-test/test-body.md#branching-with-if) fix: write one test per case, or one it.each table (assert-to-narrow.md#an-if, it-each-over-typed-rows.md#branching)`,
    );
  });

  it("names after a Hone finding's fix no team example answering the team's own check of the same name", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamSymptom: Symptom = {
      ...BRANCH_IN_A_TEST,
      ruleSet: acme,
      sourceFile: "team-rules/rules/typescript/symptoms/branch-in-a-test.md",
      recipes: [],
    };
    const teamCheck: Check = {
      name: "test-body",
      symptom: { ruleSet: acme, name: "branch-in-a-test" },
      page: "team-rules/rules/typescript/checks/branch-in-a-test/test-body.md",
      engines: [WALKER],
      forms: ["branching-with-if"],
      findingSpecifics: [],
    };
    const teamRecipe: Recipe = {
      ...IT_EACH_OVER_TYPED_ROWS,
      ruleSet: acme,
      sourceFile: "team-rules/rules/typescript/recipes/it-each-over-typed-rows.md",
      examples: [
        {
          anchor: "branching",
          answers: [
            {
              check: { name: "test-body", symptom: { ruleSet: acme, name: "branch-in-a-test" } },
              form: "branching-with-if",
            },
          ],
        },
      ],
    };
    const catalogue: SymptomCatalogue = {
      ...REPORT_CATALOGUE,
      symptoms: [BRANCH_IN_A_TEST, teamSymptom],
      checks: [TEST_BODY_CHECK, teamCheck],
      recipes: [teamRecipe],
    };

    const line = findingLine({
      catalogue,
      content: {
        ...createRuleContent({ catalogues: [catalogue] }),
        ...createCheckPages({ catalogues: [catalogue] }),
      },
      finding: BRANCH_FINDING,
      symptomPage: SYMPTOM_PAGE,
    });

    expect(line).toBe(
      `branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; symptom: branch-in-a-test (${SYMPTOM_PAGE}#branch-in-a-test) may indicate: straight-through-tests, no-hidden-effects form: branching-with-if (branch-in-a-test/test-body.md#branching-with-if) fix: write one test per case, or one it.each table`,
    );
  });

  it("names after a team finding's fix the team's example by its own file", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const symptom: Symptom = {
      ...BRANCH_IN_A_TEST,
      ruleSet: acme,
      sourceFile: "team-rules/rules/typescript/symptoms/branch-in-a-test.md",
      recipes: [],
    };
    const check: Check = {
      name: "test-body",
      symptom: { ruleSet: acme, name: "branch-in-a-test" },
      page: "team-rules/rules/typescript/checks/branch-in-a-test/test-body.md",
      engines: [WALKER],
      forms: ["branching-with-if"],
      findingSpecifics: [],
    };
    const recipe: Recipe = {
      ...IT_EACH_OVER_TYPED_ROWS,
      ruleSet: acme,
      sourceFile: "team-rules/rules/typescript/recipes/it-each-over-typed-rows.md",
      examples: [
        {
          anchor: "branching",
          answers: [
            {
              check: { name: "test-body", symptom: { ruleSet: acme, name: "branch-in-a-test" } },
              form: "branching-with-if",
            },
          ],
        },
      ],
    };

    const catalogue: SymptomCatalogue = {
      ...REPORT_CATALOGUE,
      symptoms: [symptom],
      checks: [check],
      recipes: [recipe],
    };

    const line = findingLine({
      catalogue,
      content: {
        ...createRuleContent({ catalogues: [catalogue] }),
        ...createCheckPages({ catalogues: [catalogue] }),
      },
      finding: { ...BRANCH_FINDING, ruleSet: symptom.ruleSet },
      symptomPage: SYMPTOM_PAGE,
    });

    expect(line).toBe(
      "acme/branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; symptom: branch-in-a-test (team-rules/rules/typescript/symptoms/branch-in-a-test.md) may indicate: straight-through-tests, no-hidden-effects form: branching-with-if (team-rules/rules/typescript/checks/branch-in-a-test/test-body.md#branching-with-if) fix: write one test per case, or one it.each table (team-rules/rules/typescript/recipes/it-each-over-typed-rows.md#branching)",
    );
  });

  it("names no fix when the catalogue has no check for the finding", () => {
    const catalogue = { ...REPORT_CATALOGUE, checks: [CLOCK_CHECK, CAST_CHECK] };

    const line = findingLine({
      catalogue,
      content: {
        ...createRuleContent({ catalogues: [{ symptoms: [] }] }),
        ...createCheckPages({ catalogues: [catalogue] }),
      },
      finding: BRANCH_FINDING,
      symptomPage: SYMPTOM_PAGE,
    });

    expect(line).toBe(
      "branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return;",
    );
  });

  it("uses the team symptom's own page in its finding", () => {
    const symptom: Symptom = {
      name: "outside-import-past-a-boundary",
      ruleSet: { name: ruleSetNameOf("acme") },
      sourceFile: "rules/team/symptoms/outside-import-past-a-boundary.md",
      title: "Outside import past a boundary",
      seen: "A domain unit imports an outside dependency.",
      mayIndicate: DATE_USED_DIRECTLY.mayIndicate,
      breachUsuallySits: "at the boundary",
      recipes: [],
      correctUses: [],
    };
    const check: Check = {
      name: "no-moment",
      symptom: { ruleSet: { name: ruleSetNameOf("acme") }, name: "outside-import-past-a-boundary" },
      page: "rules/team/checks/no-moment.md",
      engines: [ESLINT_ENGINE],
      forms: [],
      findingSpecifics: [],
    };
    const catalogue: SymptomCatalogue = {
      ...REPORT_CATALOGUE,
      checks: [check],
      symptoms: [symptom],
    };

    expect(
      findingLine({
        catalogue,
        content: {
          ...createRuleContent({ catalogues: [catalogue] }),
          ...createCheckPages({ catalogues: [catalogue] }),
        },
        finding: { ...TEAM_FINDING, ruleSet: symptom.ruleSet },
        symptomPage: SYMPTOM_PAGE,
      }),
    ).toBe(
      "acme/outside-import-past-a-boundary#no-moment eslint src/orders/charge-order.ts:1:0 moment() symptom: outside-import-past-a-boundary (rules/team/symptoms/outside-import-past-a-boundary.md) may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
    );
  });

  it("leads with the check address and mechanism when the catalogue has no check for the finding, and names no symptom", () => {
    expect(
      findingLine({
        catalogue: REPORT_CATALOGUE,
        content: UNSITED_CONTENT,
        finding: TEAM_FINDING,
        symptomPage: SYMPTOM_PAGE,
      }),
    ).toBe(
      "outside-import-past-a-boundary#no-moment eslint src/orders/charge-order.ts:1:0 moment()",
    );
  });

  it("says the catalogue and the records disagree when no catalogue holds the symptom its check names", () => {
    const content = UNSITED_CONTENT;

    const line = findingLine({
      catalogue: REPORT_CATALOGUE,
      content,
      finding: CLOCK_FINDING,
      symptomPage: SYMPTOM_PAGE,
    });

    expect(line).toBe(
      "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); date-used-directly: the catalogue and the records disagree, since a check, sighting or record names this symptom and no catalogue holds it",
    );
  });
});

describe("answeredLine", () => {
  it("names each record that answers the finding, by its kind, after the finding's place and snippet", () => {
    const clockLocation: PlacedRecord = {
      place: {
        file: repoPathOf("hone-records/authorised-locations/date-used-directly.json"),
        index: 0,
      },
      record: {
        kind: "authorised-location",
        symptom: DATE_USED_DIRECTLY,
        reach: { reaches: "one-check", check: CLOCK_CHECK },
        file: ORDER_FILE,
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: {},
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    };
    expect(
      answeredLine({
        catalogue: REPORT_CATALOGUE,
        content: CONTENT,
        answered: { finding: CLOCK_FINDING, by: [DEBT, clockLocation] },
      }),
    ).toBe(
      "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); answered by debt answered by authorised-location carried",
    );
  });

  it("names the form and the fix before the records when any answering record is a debt and the check names one, and names no indications", () => {
    expect(
      answeredLine({
        catalogue: REPORT_CATALOGUE,
        content: CONTENT,
        answered: { finding: BRANCH_FINDING, by: [NOTED_TEST_BODY_LOCATION, TEST_BODY_DEBT] },
      }),
    ).toBe(
      `branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; form: branching-with-if (branch-in-a-test/test-body.md#branching-with-if) fix: write one test per case, or one it.each table answered by authorised-location carried note: the catalogue has no check "test-bodies" of branch-in-a-test answered by debt`,
    );
  });

  it("names no fix when no debt answers the finding", () => {
    expect(
      answeredLine({
        catalogue: REPORT_CATALOGUE,
        content: CONTENT,
        answered: { finding: BRANCH_FINDING, by: [NOTED_TEST_BODY_LOCATION] },
      }),
    ).toBe(
      'branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; answered by authorised-location carried note: the catalogue has no check "test-bodies" of branch-in-a-test',
    );
  });
});

describe("heldLine", () => {
  it("prints a held inline disable that names its rule by its check, place and text without fix advice, then names each record that holds it, by its kind", () => {
    const clockLocation: PlacedRecord = {
      place: {
        file: repoPathOf("hone-records/authorised-locations/date-used-directly.json"),
        index: 0,
      },
      record: {
        kind: "authorised-location",
        symptom: DATE_USED_DIRECTLY,
        reach: { reaches: "one-check", check: CLOCK_CHECK },
        file: ORDER_FILE,
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: {},
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    };
    expect(
      heldLine({
        catalogue: REPORT_CATALOGUE,
        held: {
          exception: {
            ruleSet: "hone",
            kind: "inline-disable",
            check: "claimed-type#cast-expressions",
            file: WEBHOOK_FILE,
            line: 8,
            text: "// eslint-disable-next-line @typescript-eslint/consistent-type-assertions",
            reach: "one-check",
            mechanism: ESLINT,
          },
          by: [DEBT, clockLocation],
        },
      }),
    ).toBe(
      "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:8 // eslint-disable-next-line @typescript-eslint/consistent-type-assertions held by debt held by authorised-location carried",
    );
  });

  it("notes that a held inline disable naming no rule escapes every selected check", () => {
    const clockLocation: PlacedRecord = {
      place: {
        file: repoPathOf("hone-records/authorised-locations/date-used-directly.json"),
        index: 0,
      },
      record: {
        kind: "authorised-location",
        symptom: DATE_USED_DIRECTLY,
        reach: { reaches: "one-check", check: CLOCK_CHECK },
        file: ORDER_FILE,
        holding: {
          binding: { binds: "check-and-file" },
          held: "carried",
          entry: {},
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
      },
    };
    expect(
      heldLine({
        catalogue: REPORT_CATALOGUE,
        held: {
          exception: {
            ruleSet: "hone",
            kind: "inline-disable",
            check: "claimed-type#cast-expressions",
            file: WEBHOOK_FILE,
            line: 8,
            text: "// eslint-disable-next-line",
            reach: "every-selected-check",
            mechanism: ESLINT,
          },
          by: [DEBT, clockLocation],
        },
      }),
    ).toBe(
      "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:8 // eslint-disable-next-line names no rule and escapes every selected check held by debt held by authorised-location carried",
    );
  });
});

describe("the lines that name a check", () => {
  it("prints an edition by its check, engine, the edition that ran and the latest", () => {
    expect(
      editionLine({
        reading: {
          check: CLOCK_CHECK,
          engine: { name: "walker" },
          edition: editionOf("2"),
          latest: editionOf("3"),
        },
      }),
    ).toBe("date-used-directly#clock-sources walker edition 2 of 3");
  });

  it("prints a check by its address", () => {
    expect(checkLine({ check: TEST_BODY_CHECK })).toBe("branch-in-a-test#test-body");
  });

  it("prints a check that is adopted and not run as enforced by review", () => {
    expect(notRunLine({ check: TEST_BODY_CHECK })).toBe(
      "branch-in-a-test#test-body adopted, engine not run: enforced by review",
    );
  });
});

describe("unrecordedLines", () => {
  it.each<{
    readonly name: string;
    readonly exception: AttributedCheckException;
    readonly line: string;
  }>([
    {
      name: "an ignore",
      exception: {
        ruleSet: "hone",
        kind: "ignore",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts",
    },
    {
      name: "a config override",
      exception: {
        ruleSet: "hone",
        kind: "config-override",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint config-override src/adapters/stripe-webhook.ts",
    },
    {
      name: "a suppression entry",
      exception: {
        ruleSet: "hone",
        kind: "suppression-entry",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        location: repoPathOf("eslint-suppressions.json"),
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint suppression-entry src/adapters/stripe-webhook.ts eslint-suppressions.json",
    },
    {
      name: "an inline disable of one rule",
      exception: {
        ruleSet: "hone",
        kind: "inline-disable",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        line: 4,
        text: "// eslint-disable-next-line no-restricted-syntax",
        reach: "one-check",
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:4 // eslint-disable-next-line no-restricted-syntax",
    },
    {
      name: "an inline disable that names no rule",
      exception: {
        ruleSet: "hone",
        kind: "inline-disable",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        line: 4,
        text: "// eslint-disable-next-line",
        reach: "every-selected-check",
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:4 // eslint-disable-next-line names no rule and escapes every selected check",
    },
    {
      name: "an inline rule config",
      exception: {
        ruleSet: "hone",
        kind: "inline-rule-config",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        line: 1,
        text: "/* eslint no-restricted-syntax: off */",
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint inline-rule-config src/adapters/stripe-webhook.ts:1 /* eslint no-restricted-syntax: off */",
    },
    {
      name: "a command-line option that weakens the whole run",
      exception: {
        ruleSet: "hone",
        kind: "command-line-option",
        check: "claimed-type#cast-expressions",
        location: PACKAGE_FILE,
        script: "lint",
        option: "--no-inline-config",
        cause: { kind: "weakens-run" },
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint command-line-option package.json lint --no-inline-config weakens the script's whole run, so no record can cover it: remove it from the script",
    },
    {
      name: "a command-line option after another command",
      exception: {
        ruleSet: "hone",
        kind: "command-line-option",
        check: "claimed-type#cast-expressions",
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: {
          kind: "after-another-command",
          command: "eslint",
          invocation: "eslint --rule x:off .",
        },
        mechanism: ESLINT,
      },
      line: 'claimed-type#cast-expressions eslint command-line-option package.json lint --rule x:off: eslint is not the first command of its script, so Hone cannot tell what the option does to the files under check; give eslint a script of its own, such as "eslint --rule x:off ."',
    },
    {
      name: "a wrapped command-line option",
      exception: {
        ruleSet: "hone",
        kind: "command-line-option",
        check: "claimed-type#cast-expressions",
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
      exception: {
        ruleSet: "hone",
        kind: "command-line-option",
        check: "claimed-type#cast-expressions",
        location: PACKAGE_FILE,
        script: "lint",
        option: "eslint 'x",
        cause: { kind: "unreadable", command: "eslint" },
        mechanism: ESLINT,
      },
      line: "claimed-type#cast-expressions eslint command-line-option package.json lint eslint 'x: a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check; pair every quote in the script",
    },
  ])("prints $name led by the check it suppresses", ({ exception, line }) => {
    expect(unrecordedLines({ catalogue: REPORT_CATALOGUE, exception })).toEqual([line]);
  });

  it("prints an unregistered suppression by its check address and engine", () => {
    expect(
      unrecordedLines({
        catalogue: REPORT_CATALOGUE,
        exception: {
          ruleSet: "hone",
          kind: "ignore",
          check: "outside-import-past-a-boundary#no-moment",
          file: ORDER_FILE,
          mechanism: ESLINT,
        },
      }),
    ).toEqual([
      "outside-import-past-a-boundary#no-moment eslint ignore src/orders/charge-order.ts",
    ]);
  });

  it("gives a suppression the line for its check when another check shares the symptom", () => {
    expect(
      unrecordedLines({
        catalogue: { ...REPORT_CATALOGUE, checks: [CAST_CHECK, SECOND_CAST_CHECK] },
        exception: {
          ruleSet: "hone",
          kind: "ignore",
          check: "claimed-type#cast-walker",
          file: WEBHOOK_FILE,
          mechanism: ESLINT,
        },
      }),
    ).toEqual(["claimed-type#cast-walker eslint ignore src/adapters/stripe-webhook.ts"]);
  });
});
