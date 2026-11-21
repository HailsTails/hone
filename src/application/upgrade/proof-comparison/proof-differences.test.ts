import { describe, expect, it } from "vitest";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { AttributedNativeException, Finding } from "../../../domain/finding/governance.ts";
import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { FIRST_EDITION } from "../../../infrastructure/content-files/edition.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { MarkedNotAdopted } from "../../ports/upgrade/proof-outcome.ts";
import { proofDifferencesOf } from "./proof-differences.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const SRC_A = repoPathSchema.parse("src/a.ts");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT_ENGINE], forms: [] };

const LOOP_KEYWORD_TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const REBINDING_TEST_BODY: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
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

const EMPTY_BEFORE: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const EMPTY_AFTER: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  uncovered: [],
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

const LOOP_FINDING: Finding = { clause: LOOPS_CLAUSE, file: SRC_A, anchor: { line: 3, column: 1 }, snippet: "the loop line", mechanism: AUDIT };

const NAMED_LOOP_FINDING: Finding = { ...LOOP_FINDING, check: "loop-keyword#loops" };

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const AUTHORISED: ExceptionRecord = { kind: "authorised-location", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "kept" };

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/loop-keyword.json"), index: 0 },
  record: { kind: "debt", symptom: LOOP_KEYWORD_LOOPS.symptom, reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS }, file: SRC_A, holding: { held: "stated" } },
};

const AUTHORISED_LOCATION: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/loop-keyword.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: LOOP_KEYWORD_LOOPS.symptom,
    reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS },
    file: SRC_A,
    holding: { held: "carried", entry: {}, lacks: [], standing: "established" },
  },
};

const INLINE_DISABLE: AttributedNativeException = {
  kind: "inline-disable",
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  line: 3,
  text: "eslint-disable-next-line",
  reach: "one-clause",
  mechanism: AUDIT,
};

const MARKED_TEST_BODY: MarkedNotAdopted = {
  check: { ruleSet: TOOL_RULE_SET, check: "loop-keyword#test-body" },
  clause: TEST_BODY_CLAUSE,
  reason: "discipline-not-selected",
};

const differencesBetween = (request: {
  readonly before?: Partial<CheckReport>;
  readonly after?: Partial<RunReport>;
  readonly marked?: readonly MarkedNotAdopted[];
}) => {
  const given = { marked: [], ...request };
  return proofDifferencesOf({
    before: { ...EMPTY_BEFORE, ...given.before },
    after: { ...EMPTY_AFTER, ...given.after },
    marked: given.marked,
    catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }],
  });
};

describe("proofDifferencesOf", () => {
  it("finds no difference when version 2 reports as not adopted what version 1 reported and what the upgrade marked", () => {
    expect(
      differencesBetween({
        before: { notAdopted: [LOOPS_CLAUSE] },
        after: { "not-adopted": [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY] },
        marked: [MARKED_TEST_BODY],
      }),
    ).toEqual([]);
  });

  it("names a mark version 2 does not report as not adopted", () => {
    expect(differencesBetween({ marked: [MARKED_TEST_BODY] })).toEqual([
      { section: "not-adopted", onlyBefore: ["CD-27#test-body-logic"], onlyAfter: [] },
    ]);
  });

  it("names a clause version 2 reports as not adopted that version 1 reported as not run", () => {
    expect(differencesBetween({ before: { notRun: [LOOPS_CLAUSE] }, after: { "not-adopted": [LOOP_KEYWORD_LOOPS] } })).toEqual([
      { section: "not-adopted", onlyBefore: [], onlyAfter: ["CD-15#loops"] },
      { section: "not-run", onlyBefore: ["CD-15#loops"], onlyAfter: [] },
    ]);
  });

  it("finds no difference between two reports that hold nothing", () => {
    expect(differencesBetween({})).toEqual([]);
  });

  it("finds no difference for a finding both sides report, version 2's named check read as its clause", () => {
    expect(differencesBetween({ before: { findings: [LOOP_FINDING] }, after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([]);
  });

  it("names a finding only version 2 reports, with the verdict that follows", () => {
    expect(differencesBetween({ after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] },
      { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
    ]);
  });

  it("reads version 2's finding at the clause of the check it names, so a wrong attribution is a difference", () => {
    const misattributed: Finding = { ...LOOP_FINDING, check: "rebinding#test-body" };
    expect(differencesBetween({ before: { findings: [LOOP_FINDING] }, after: { findings: [misattributed] } })).toEqual([
      { section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: ["CD-27#test-body-logic src/a.ts 3:1"] },
    ]);
  });

  it("counts a finding as many times as a side reports it", () => {
    expect(differencesBetween({ before: { findings: [LOOP_FINDING, LOOP_FINDING] }, after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: [] },
    ]);
  });

  it("finds no difference when a file carve-out answered a finding and a debt answers it now", () => {
    expect(differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] }, after: { answered: [{ finding: NAMED_LOOP_FINDING, by: [DEBT] }] } })).toEqual([]);
  });

  it("finds no difference when an authorised location answered a finding and one answers it now", () => {
    expect(
      differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [AUTHORISED] }] }, after: { answered: [{ finding: NAMED_LOOP_FINDING, by: [AUTHORISED_LOCATION] }] } }),
    ).toEqual([]);
  });

  it("names a finding answered by another kind of record than before", () => {
    expect(differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] }, after: { answered: [{ finding: NAMED_LOOP_FINDING, by: [AUTHORISED_LOCATION] }] } })).toEqual([
      {
        section: "answered",
        onlyBefore: ["CD-15#loops src/a.ts 3:1 answered by debt"],
        onlyAfter: ["CD-15#loops src/a.ts 3:1 answered by authorised-location"],
      },
    ]);
  });

  it("names a finding answered before that version 2 leaves unanswered, in both sections and the verdict", () => {
    expect(differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] }, after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] },
      { section: "answered", onlyBefore: ["CD-15#loops src/a.ts 3:1 answered by debt"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
    ]);
  });

  it("names a native exception only one side reports as unrecorded", () => {
    expect(differencesBetween({ before: { unrecorded: [INLINE_DISABLE] } })).toEqual([
      { section: "unrecorded", onlyBefore: ["audit inline-disable CD-15#loops src/a.ts:3"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("names a clause uncovered on one side", () => {
    expect(differencesBetween({ before: { uncovered: [TEST_BODY_CLAUSE] }, after: { uncovered: [] } })).toEqual([
      { section: "uncovered", onlyBefore: ["CD-27#test-body-logic"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("reads each uncovered check as its clause, once", () => {
    expect(differencesBetween({ before: { uncovered: [TEST_BODY_CLAUSE] }, after: { uncovered: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] } })).toEqual([]);
  });

  it("names a clause that is stale on a side, by its file", () => {
    expect(differencesBetween({ before: { stale: [CARVE_OUT] } })).toEqual([
      { section: "stale", onlyBefore: ["src/a.ts"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("names a finding whose check version 2 does not name, never reading it at the finding's own clause", () => {
    expect(differencesBetween({ before: { findings: [LOOP_FINDING] }, after: { findings: [LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: ["unknown-check none src/a.ts 3:1"] },
    ]);
  });

  it("names a finding whose check the catalogue does not hold", () => {
    expect(differencesBetween({ before: { findings: [LOOP_FINDING] }, after: { findings: [{ ...LOOP_FINDING, check: "loop-keyword#lops" }] } })).toEqual([
      { section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: ["unknown-check loop-keyword#lops src/a.ts 3:1"] },
    ]);
  });

  it("names a rule id version 2 reads as naming no check, with the verdict that follows", () => {
    expect(differencesBetween({ after: { misnamed: [{ kind: "names-no-check", ruleId: "hone/loop-keyword#none", file: SRC_A, line: 4, text: "eslint-disable" }] } })).toEqual([
      { section: "misnamed", onlyBefore: [], onlyAfter: ["names-no-check hone/loop-keyword#none src/a.ts 4"] },
      { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
    ]);
  });

  it("names a debt version 2 finds paid, which a wrong write would be", () => {
    expect(differencesBetween({ after: { paid: [{ debt: DEBT, answeredBy: [AUTHORISED_LOCATION] }] } })).toEqual([
      { section: "paid", onlyBefore: [], onlyAfter: ["hone-records/debt/loop-keyword.json 0"] },
    ]);
  });

  it("names a file excluded on one side only", () => {
    expect(differencesBetween({ before: { excluded: [SRC_A] }, after: { excluded: [repoPathSchema.parse("generated")] } })).toEqual([
      { section: "excluded", onlyBefore: ["src/a.ts"], onlyAfter: ["generated"] },
    ]);
  });

  it("names a pair version 1 holds doubly, which version 2 has no section for", () => {
    expect(differencesBetween({ before: { doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }] } })).toEqual([
      { section: "doubly-held", onlyBefore: ["CD-15#loops src/a.ts audit"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("names a record version 1 held invalid against one version 2 refuses, by place", () => {
    expect(
      differencesBetween({
        before: { invalidRecords: [{ place: { layout: "single-file", file: SRC_A, index: 1 }, problem: { kind: "clause-unparseable", detail: "x" } }] },
        after: { refused: [{ place: { file: repoPathSchema.parse("hone-records/debt/loop-keyword.json"), index: 0 }, refusals: [{ kind: "unknown-symptom", symptom: "x" }] }] },
      }),
    ).toEqual([{ section: "invalid-records", onlyBefore: ["src/a.ts 1"], onlyAfter: ["hone-records/debt/loop-keyword.json 0"] }]);
  });

  it("reads each side's editions at the clause its checks serve", () => {
    expect(
      differencesBetween({
        before: { editions: [{ address: LOOPS_CLAUSE, mechanism: AUDIT, edition: FIRST_EDITION, latest: FIRST_EDITION }] },
        after: { editions: [{ check: LOOP_KEYWORD_LOOPS, engine: { name: "walker", mechanism: AUDIT }, edition: FIRST_EDITION, latest: FIRST_EDITION }] },
      }),
    ).toEqual([]);
  });

  it("names an engine not run on one side", () => {
    expect(differencesBetween({ before: { unmeasured: [{ kind: "mechanism-not-run", mechanism: AUDIT, projection: "missing" }] } })).toEqual([
      { section: "unmeasured", onlyBefore: ["audit not-run missing"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });
});
