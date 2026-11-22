import { describe, expect, it } from "vitest";
import type { Finding } from "../../finding/governance.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { Case, Check, Engine, Pointed, Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import { debtSitesOf, unrecordableSitesOf } from "./debt-sites.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

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

const BOUNDARY_RECORD: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

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
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD, at: "on the clock adapter" }],
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

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const TEST_BODY_LOGIC = clauseAddressSchema.parse("CD-27#test-body-logic");

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const CLOCK_CHECK: Check = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, engines: [WALKER], forms: [] };

const TEST_BODY_CHECK: Check = { name: "test-body", symptom: BRANCH_IN_A_TEST, clause: TEST_BODY_LOGIC, engines: [WALKER], forms: ["branching-with-if"] };

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD, DEBT_KIND],
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

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "chargedAt" };

const CAST_FINDING: Finding = { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: WEBHOOK_FILE, anchor: { line: 4, column: 9 }, snippet: "body as Event" };

const UNCATALOGUED_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-99#nowhere"),
  mechanism: AUDIT,
  file: ORDER_FILE,
  anchor: { line: 1, column: 0 },
  snippet: "x",
};

describe("the findings no debt can be written for", () => {
  it("names a finding whose clause the catalogue names no symptom for, by its clause", () => {
    expect(unrecordableSitesOf({ catalogue: REPORT_CATALOGUE, findings: [UNCATALOGUED_FINDING, CLOCK_FINDING] })).toEqual([{ address: "CD-99#nowhere", file: ORDER_FILE, because: { kind: "no-check" } }]);
  });

  it("names a finding whose named check is not of its clause", () => {
    expect(unrecordableSitesOf({ catalogue: REPORT_CATALOGUE, findings: [{ ...CAST_FINDING, check: "claimed-type#no-such-check" }] })).toEqual([
      { address: "CD-2#cast-expressions", file: WEBHOOK_FILE, because: { kind: "no-check" } },
    ]);
  });

  it("names a finding whose named check is not run by the engine that raised it", () => {
    expect(unrecordableSitesOf({ catalogue: REPORT_CATALOGUE, findings: [{ ...CLOCK_FINDING, mechanism: ESLINT, check: "date-used-directly#clock-sources" }] })).toEqual([
      { address: "CD-17#clock-sources", file: ORDER_FILE, because: { kind: "no-check" } },
    ]);
  });

  it("names each clause and file once", () => {
    expect(unrecordableSitesOf({ catalogue: REPORT_CATALOGUE, findings: [UNCATALOGUED_FINDING, { ...UNCATALOGUED_FINDING, anchor: { line: 9, column: 1 } }] })).toEqual([
      { address: "CD-99#nowhere", file: ORDER_FILE, because: { kind: "no-check" } },
    ]);
  });
});

describe("the debt a run's unanswered findings call for", () => {
  it("names a finding by its symptom and the check that found it", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [CLOCK_FINDING] })).toEqual([{ address: "date-used-directly#clock-sources", file: ORDER_FILE, origin: "finding" }]);
  });

  it("names a finding by the check it carries over the clause's own", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [{ ...CLOCK_FINDING, check: "date-used-directly#clock-sources" }] })).toEqual([
      { address: "date-used-directly#clock-sources", file: ORDER_FILE, origin: "finding" },
    ]);
  });

  it("names a finding by its symptom alone when no check of the symptom found it", () => {
    expect(
      debtSitesOf({ catalogue: { ...REPORT_CATALOGUE, checks: [] }, findings: [CLOCK_FINDING] }),
    ).toEqual([{ address: "date-used-directly", file: ORDER_FILE, origin: "finding" }]);
  });

  it("lists each symptom, check and file once, ordered by file then address", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [CLOCK_FINDING, CAST_FINDING, { ...CLOCK_FINDING, anchor: { line: 20, column: 4 } }] })).toEqual([
      { address: "claimed-type#cast-expressions", file: WEBHOOK_FILE, origin: "finding" },
      { address: "date-used-directly#clock-sources", file: ORDER_FILE, origin: "finding" },
    ]);
  });

  it("skips a finding whose clause the catalogue does not name a symptom for", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [UNCATALOGUED_FINDING, { ...CLOCK_FINDING, clause: TEST_BODY_LOGIC }] })).toEqual([]);
  });
});
