import { describe, expect, it } from "vitest";
import type { Case, Check, Engine, Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { ChecksSliceProblem, MisnamedRuleId } from "../../domain/runner/checks-run-report.ts";
import type { Hit } from "../../domain/runner/runner-result-types.ts";
import type { Debt, PlacedRecord, RecordsReading, RefusedRecord, SymptomReach } from "../../domain/records/hone-records/hone-record.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { TouchedSet } from "../../domain/repository/touched-set.ts";
import type { EngineRun } from "../ports/engine/engine-run.ts";
import { type RunReportRequest, runReportOf } from "./run-report-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
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

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

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
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION }],
};

const CLOCK_SOURCES = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-17"), clause: clauseIdOf("clock-sources") };

const TEST_BODY_LOGIC = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") };

const CAST_EXPRESSIONS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") };

const CLOCK_CHECK: Check = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, engines: [WALKER], forms: [] };

const TEST_BODY_CHECK: Check = { name: "test-body", symptom: BRANCH_IN_A_TEST, clause: TEST_BODY_LOGIC, engines: [WALKER], forms: ["branching-with-if"] };

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION, BOUNDARY_RECORD, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
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

const FILE_A = repoPathOf("src/a.ts");

const FILE_B = repoPathOf("src/b.ts");

const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const CAST_HIT: Hit = { clause: CAST_EXPRESSIONS, file: FILE_A, anchor: { line: 4, column: 9 }, snippet: "body as Event", check: "claimed-type#cast-expressions" };

const CAST_FINDING = { ...CAST_HIT, mechanism: ESLINT };

const eslintRunOf = (request: { readonly hits: readonly Hit[]; readonly projection: EngineRun["projection"] }): EngineRun => ({
  mechanism: ESLINT,
  hits: request.hits,
  nativeExceptions: [],
  coverableKinds: ["config-override", "inline-disable"],
  projection: request.projection,
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
});

const debtAt = (request: { readonly file: Debt["file"]; readonly index: number }): PlacedRecord => ({
  place: { file: DEBT_FILE, index: request.index },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: request.file, holding: { held: "stated" } },
});

const SELECTS_CAST: RunReportRequest["selection"] = {
  selected: [{ address: CAST_EXPRESSIONS, mechanism: ESLINT, exceptions: "allowed" }],
  uncovered: [],
  notAdopted: [],
  notRun: [],
  editions: [],
};

const LOCATION_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const carriedLocationAt = (request: { readonly file: Debt["file"]; readonly index: number }): PlacedRecord => ({
  place: { file: LOCATION_FILE, index: request.index },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: request.file,
    holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
  },
});

const NO_RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const MEASURED_NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const REQUEST: RunReportRequest = {
  available: [],
  catalogue: REPORT_CATALOGUE,
  selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  excluded: [],
  notes: [],
  records: NO_RECORDS,
  touched: MEASURED_NOTHING_TOUCHED,
  runs: [],
  tracked: [FILE_A, FILE_B],
};

const EMPTY_REPORT: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  available: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  "projection-problems": [],
  assessment: [],
  "settings-notes": [],
  "record-notes": [],
  carried: [],
  symptoms: [],
};

describe("runReportOf, findings and records", () => {
  it("reports a finding no record answers, naming its mechanism, with the note of its symptom", () => {
    expect(runReportOf({ ...REQUEST, runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })] })).toEqual({
      ...EMPTY_REPORT,
      findings: [CAST_FINDING],
      symptoms: [CLAIMED_TYPE],
    });
  });

  it("reports a finding whose engine names no check with the check the catalogue resolves for it", () => {
    const unnamedHit: Hit = { clause: CLOCK_SOURCES, file: FILE_A, anchor: { line: 2, column: 0 }, snippet: "startedAt" };
    expect(runReportOf({ ...REQUEST, runs: [{ ...eslintRunOf({ hits: [unnamedHit], projection: "current" }), mechanism: AUDIT }] })).toEqual({
      ...EMPTY_REPORT,
      findings: [{ ...unnamedHit, mechanism: AUDIT, check: "date-used-directly#clock-sources" }],
      symptoms: [DATE_USED_DIRECTLY],
    });
  });

  it("reports a finding a record answers as answered, and the record as not stale", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(runReportOf({ ...REQUEST, records: { ...NO_RECORDS, records: [debt] }, runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })] })).toEqual({
      ...EMPTY_REPORT,
      answered: [{ finding: CAST_FINDING, by: [debt] }],
    });
  });

  it("reports a record that answers nothing as stale", () => {
    const debt = debtAt({ file: FILE_B, index: 0 });
    expect(runReportOf({ ...REQUEST, records: { ...NO_RECORDS, records: [debt] }, runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })] })).toEqual({
      ...EMPTY_REPORT,
      findings: [CAST_FINDING],
      stale: [{ placed: debt, reason: "credited-nothing" }],
      symptoms: [CLAIMED_TYPE],
    });
  });

  it("does not call a record stale when the engine measuring its check was not in effect, since nothing was measured", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(runReportOf({ ...REQUEST, selection: SELECTS_CAST, records: { ...NO_RECORDS, records: [debt] }, runs: [eslintRunOf({ hits: [], projection: "not-included" })] })).toEqual({
      ...EMPTY_REPORT,
      unmeasured: [{ kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "not-included", nestedConfigurations: [] }],
    });
  });

  it("does not call a record stale when a package slice is missing and the engine measured no file under a current root projection, and says the engine measured nothing", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    const missingSlice: ChecksSliceProblem = { slice: repoPathOf("packages/a/hone.eslint.mjs"), state: "missing" };
    expect(
      runReportOf({ ...REQUEST, selection: SELECTS_CAST, records: { ...NO_RECORDS, records: [debt] }, runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), slices: [missingSlice] }] }),
    ).toEqual({
      ...EMPTY_REPORT,
      unmeasured: [{ kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" }],
      "projection-problems": [{ scope: "slice", engine: ESLINT_ENGINE, state: "missing", slice: missingSlice.slice }],
    });
  });

  it("does not call a record stale when the projection is out of date and the engine linted nothing, and says the engine measured nothing beside the out-of-date problem", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(runReportOf({ ...REQUEST, selection: SELECTS_CAST, records: { ...NO_RECORDS, records: [debt] }, runs: [eslintRunOf({ hits: [], projection: "out-of-date" })] })).toEqual({
      ...EMPTY_REPORT,
      unmeasured: [{ kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" }],
      "projection-problems": [{ scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }],
    });
  });

  it("calls a record stale once the engine measured its check at its file and nothing credited it", () => {
    const debt = debtAt({ file: FILE_B, index: 0 });
    expect(
      runReportOf({
        ...REQUEST,
        selection: SELECTS_CAST,
        records: { ...NO_RECORDS, records: [debt] },
        runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), measured: [{ clause: CAST_EXPRESSIONS, file: FILE_B }] }],
      }),
    ).toEqual({ ...EMPTY_REPORT, stale: [{ placed: debt, reason: "credited-nothing" }] });
  });

  it("calls a record stale when its file is no longer in the tree, since no run can measure a file that is gone", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(
      runReportOf({
        ...REQUEST,
        selection: SELECTS_CAST,
        tracked: [FILE_B],
        records: { ...NO_RECORDS, records: [debt] },
        runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), measured: [{ clause: CAST_EXPRESSIONS, file: FILE_B }] }],
      }),
    ).toEqual({ ...EMPTY_REPORT, stale: [{ placed: debt, reason: "file-gone" }] });
  });

  it("calls a record stale when the settings exclude its file, which is still in the repository but out of what is checked", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(
      runReportOf({
        ...REQUEST,
        selection: SELECTS_CAST,
        excluded: [FILE_A],
        tracked: [FILE_B],
        records: { ...NO_RECORDS, records: [debt] },
        runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), measured: [{ clause: CAST_EXPRESSIONS, file: FILE_B }] }],
      }),
    ).toEqual({ ...EMPTY_REPORT, excluded: [FILE_A], stale: [{ placed: debt, reason: "file-excluded" }] });
  });

  it("does not call a record stale when the engine measured other files but not its file", () => {
    const debt = debtAt({ file: FILE_B, index: 0 });
    expect(
      runReportOf({
        ...REQUEST,
        selection: SELECTS_CAST,
        records: { ...NO_RECORDS, records: [debt] },
        runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), measured: [{ clause: CAST_EXPRESSIONS, file: FILE_A }] }],
      }),
    ).toEqual(EMPTY_REPORT);
  });

  it("reports debt on a file the change touched as forfeited, and the finding it held as unanswered", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "yes", paths: new Set([FILE_A]) },
        records: { ...NO_RECORDS, records: [debt] },
        runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })],
      }),
    ).toEqual({ ...EMPTY_REPORT, findings: [CAST_FINDING], forfeited: [debt], symptoms: [CLAIMED_TYPE] });
  });

  it("carries what the records reading found: refused records, notes and the records carried from version 1", () => {
    const carried: PlacedRecord = {
      place: { file: DEBT_FILE, index: 3 },
      record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: FILE_B, holding: { held: "carried", entry: {}, lacks: [], standing: "established" } },
    };
    const refused: RefusedRecord = { place: { file: DEBT_FILE, index: 1 }, refusals: [{ kind: "carried-changed-since-base" }] };
    expect(runReportOf({ ...REQUEST, records: { records: [carried], refused: [refused], notes: [], base: { measured: "yes" } } })).toMatchObject({
      refused: [refused],
      carried: [{ place: { file: DEBT_FILE, index: 3 }, lacks: [], standing: "established" }],
    });
  });
});

describe("runReportOf, what the run could not measure", () => {
  it("lists debt unmeasured for forfeiture when no base revision was given, beside an engine whose projection is not written", () => {
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "no", base: { state: "not-given" } },
        records: { ...NO_RECORDS, records: [debtAt({ file: FILE_B, index: 0 })] },
        runs: [eslintRunOf({ hits: [], projection: "missing" })],
      }),
    ).toMatchObject({
      unmeasured: [
        { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
        { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
      ],
    });
  });

  it("lists a projection that differs from what project writes now as a projection problem", () => {
    expect(runReportOf({ ...REQUEST, runs: [eslintRunOf({ hits: [], projection: "out-of-date" })] })).toMatchObject({
      "projection-problems": [{ scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }],
    });
  });

  it("counts the debt records not checked for forfeiture when forfeiture is left elsewhere", () => {
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "elsewhere" },
        records: { ...NO_RECORDS, records: [debtAt({ file: FILE_A, index: 0 }), debtAt({ file: FILE_B, index: 1 })] },
      }),
    ).toMatchObject({ assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 2 }] });
  });

  it("counts the carried records left to another run when forfeiture is left elsewhere and no base was measured", () => {
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "elsewhere" },
        records: { ...NO_RECORDS, base: { measured: "no", base: { state: "not-given" } }, records: [carriedLocationAt({ file: FILE_A, index: 0 })] },
      }),
    ).toEqual({
      ...EMPTY_REPORT,
      stale: [{ placed: carriedLocationAt({ file: FILE_A, index: 0 }), reason: "credited-nothing" }],
      assessment: [
        { concern: "forfeiture", assessedBy: "elsewhere", debts: 0 },
        { concern: "carried-standing", assessedBy: "elsewhere", carried: 1 },
      ],
      carried: [{ place: { file: LOCATION_FILE, index: 0 }, lacks: [], standing: "unjudged" }],
    });
  });

  it("lists import-unmeasured and leaves nothing to another run when forfeiture is left elsewhere but the base was given and cannot be read", () => {
    const gitFailed = { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad object" } as const;
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "elsewhere" },
        records: { ...NO_RECORDS, base: { measured: "no", base: gitFailed }, records: [carriedLocationAt({ file: FILE_A, index: 0 })] },
      }),
    ).toMatchObject({
      unmeasured: [{ kind: "import-unmeasured", base: gitFailed }],
      assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 0 }],
    });
  });

  it("counts no carried records left to another run when forfeiture is left elsewhere but the base was measured", () => {
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "elsewhere" },
        records: { ...NO_RECORDS, records: [carriedLocationAt({ file: FILE_A, index: 0 })] },
      }).assessment,
    ).toEqual([{ concern: "forfeiture", assessedBy: "elsewhere", debts: 0 }]);
  });
});

describe("runReportOf, the selection and the settings", () => {
  it("lists the checks of the clauses marked not-adopted or not-run, the checks available to list, the editions ran, the excluded paths and the settings notes", () => {
    expect(
      runReportOf({
        ...REQUEST,
        selection: {
          selected: [],
          uncovered: [],
          notAdopted: [CAST_EXPRESSIONS],
          notRun: [TEST_BODY_LOGIC],
          editions: [{ address: CAST_EXPRESSIONS, mechanism: ESLINT, edition: editionOf("1"), latest: editionOf("2") }],
        },
        excluded: [repoPathOf("dist")],
        notes: [{ kind: "declared-not-read", key: "layers" }],
        available: [CLOCK_CHECK],
      }),
    ).toEqual({
      ...EMPTY_REPORT,
      excluded: ["dist"],
      "not-adopted": [CAST_CHECK],
      "not-run": [TEST_BODY_CHECK],
      editions: [{ check: CAST_CHECK, engine: ESLINT_ENGINE, edition: "1", latest: "2" }],
      available: [CLOCK_CHECK],
      "settings-notes": [{ kind: "declared-not-read", key: "layers" }],
    });
  });

  it("reports each misnamed rule id the runs found", () => {
    const misnamed: MisnamedRuleId = {
      kind: "version-1-id",
      ruleId: "hone/no-class-authoring",
      file: FILE_A,
      line: 2,
      text: "// eslint-disable-next-line hone/no-class-authoring",
      replacedBy: ["hone/authored-class-or-this#class-keyword"],
    };
    expect(runReportOf({ ...REQUEST, runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), misnamedRuleIds: [misnamed] }] })).toMatchObject({ misnamed: [misnamed] });
  });
});
