import { describe, expect, it } from "vitest";
import type { Finding } from "../../../domain/finding/governance.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import type { Case, Principle, Recipe, Rule, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import { escapedLineBreaks, locatedFindingLine, symptomFindingLine } from "./finding-line.ts";

const FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  mechanism: "audit",
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
};

const REMEDIED: Finding = { ...FINDING, remedy: { fix: "write a factory", page: "node_modules/@hailstails/hone/rules/CD-14/CHECKS.md", section: "a-class" } };

const LINE_BROKEN_FIX: Finding = { ...FINDING, remedy: { fix: "write\na factory", page: "rules/CD-14/CHECKS.md", section: "a-class" } };

describe("escapedLineBreaks", () => {
  it("writes each line feed and carriage return as its escape", () => {
    expect(escapedLineBreaks({ text: "a\r\nb\nc" })).toBe(String.raw`a\r\nb\nc`);
  });
});

describe("locatedFindingLine", () => {
  it("renders clause, mechanism, file:line:column and snippet", () => {
    expect(locatedFindingLine({ finding: FINDING })).toBe("CD-14#class-syntax audit src/a.ts:3:5 class A {}");
  });

  it("leaves out the fix a piece names", () => {
    expect(locatedFindingLine({ finding: REMEDIED })).toBe("CD-14#class-syntax audit src/a.ts:3:5 class A {}");
  });
});

describe("symptomFindingLine for a finding with no symptom", () => {
  it("renders a finding with no fix as its located line", () => {
    expect(symptomFindingLine({ finding: FINDING, reading: { reading: "not-in-catalogue" } })).toBe("CD-14#class-syntax audit src/a.ts:3:5 class A {}");
  });

  it("renders the fix, then the page and section it is given, after the snippet", () => {
    expect(symptomFindingLine({ finding: REMEDIED, reading: { reading: "not-in-catalogue" } })).toBe(
      "CD-14#class-syntax audit src/a.ts:3:5 class A {} fix: write a factory (node_modules/@hailstails/hone/rules/CD-14/CHECKS.md#a-class)",
    );
  });

  it("escapes a line break in the fix so the finding stays on one line", () => {
    expect(symptomFindingLine({ finding: LINE_BROKEN_FIX, reading: { reading: "not-in-catalogue" } })).toBe(
      String.raw`CD-14#class-syntax audit src/a.ts:3:5 class A {} fix: write\na factory (rules/CD-14/CHECKS.md#a-class)`,
    );
  });
});

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const KINDS_ARE_EXPLICIT: Principle = { name: "kinds-are-explicit", title: "Kinds are explicit" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: KINDS_ARE_EXPLICIT, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: KINDS_ARE_EXPLICIT, standing: "accepted" };

const STRAIGHT_THROUGH_TESTS: Rule = { name: "straight-through-tests", title: "Straight-through tests", principle: TESTS_ARE_OURS, standing: "accepted" };

const KINDS_ARE_NAMED: Rule = { name: "kinds-are-named", title: "Kinds are named", principle: KINDS_ARE_EXPLICIT, standing: "accepted" };

const FAILURES_ARE_VALUES: Rule = { name: "failures-are-values", title: "Failures are values", principle: KINDS_ARE_EXPLICIT, standing: "accepted" };

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "rule", rule: PORTS_DECLARED_INSIDE }],
};

const DOES_ONE_JOB: Case = { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] };

const CHECKS_A_VALUE: Case = {
  name: "checks-a-value-that-may-be-one-of-several-outcomes",
  title: "Checks a value that may be one of several outcomes",
  standing: "accepted",
  owes: [{ kind: "rule", rule: STRAIGHT_THROUGH_TESTS }],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "\"the world reaches a unit through a port\"", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted", reason: { text: "\"it narrows the type\"", standing: "accepted" } };

const ITEACH_OVER_TYPED_ROWS: Recipe = { name: "iteach-over-typed-rows", title: "it.each over typed rows", standing: "accepted", reason: { text: "\"each row is a case\"", standing: "accepted" } };

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
  correctUses: [],
};

const BRANCH_IN_A_TEST: Symptom = {
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "`if`, a ternary, `&&`, `||`, `??`, `?.` or `switch` in a test file.",
  mayIndicate: [
    {
      case: CHECKS_A_VALUE,
      points: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "rule", rule: KINDS_ARE_NAMED },
        { kind: "rule", rule: FAILURES_ARE_VALUES },
      ],
    },
  ],
  breachUsuallySits: "often in the unit's output type: optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const CLOCK_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-17#clock-sources"),
  mechanism: "audit",
  file: repoPathSchema.parse("src/orders/charge-order.ts"),
  anchor: { line: 14, column: 0 },
  snippet: "const chargedAt = clock.now();",
};

const TEST_LOGIC_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
  mechanism: "audit",
  file: repoPathSchema.parse("src/orders/charge-order.test.ts"),
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {",
  remedy: {
    fix: "write one test per case, or one it.each table; to narrow a value that may be missing, assert.isDefined it",
    page: "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md",
    section: "branching-with-if",
  },
};

describe("symptomFindingLine", () => {
  it("names the symptom and every rule and principle it may indicate after the snippet", () => {
    expect(symptomFindingLine({ finding: CLOCK_FINDING, reading: { reading: "named", symptom: DATE_USED_DIRECTLY } })).toBe(
      "CD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); symptom: date-used-directly, may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
    );
  });

  it("names the symptom before the fix", () => {
    expect(symptomFindingLine({ finding: TEST_LOGIC_FINDING, reading: { reading: "named", symptom: BRANCH_IN_A_TEST } })).toBe(
      "CD-27#test-body-logic audit src/orders/charge-order.test.ts:22:2 if (result.ok) { symptom: branch-in-a-test, may indicate: straight-through-tests, kinds-are-named, failures-are-values fix: write one test per case, or one it.each table; to narrow a value that may be missing, assert.isDefined it (node_modules/@hailstails/hone/rules/CD-27/CHECKS.md#branching-with-if)",
    );
  });

  it("prints a finding whose clause the catalogue does not hold exactly as a finding with no symptom", () => {
    expect(symptomFindingLine({ finding: TEST_LOGIC_FINDING, reading: { reading: "not-in-catalogue" } })).toBe(
      "CD-27#test-body-logic audit src/orders/charge-order.test.ts:22:2 if (result.ok) { fix: write one test per case, or one it.each table; to narrow a value that may be missing, assert.isDefined it (node_modules/@hailstails/hone/rules/CD-27/CHECKS.md#branching-with-if)",
    );
  });

  it("prints a finding whose clause sees no symptom exactly as a finding with no symptom", () => {
    expect(symptomFindingLine({ finding: CLOCK_FINDING, reading: { reading: "sees-no-symptom" } })).toBe(
      "CD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now();",
    );
  });
});
