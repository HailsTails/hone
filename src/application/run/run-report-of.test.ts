import { describe, expect, it } from "vitest";
import { AUDIT, CAST_CHECK, DATE_USED_DIRECTLY, CAST_EXPRESSIONS, CLAIMED_TYPE, CLOCK_CHECK, CLOCK_SOURCES, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE, TEST_BODY_CHECK, TEST_BODY_LOGIC, WHOLE_SYMPTOM } from "../../../tests/report-catalogue.ts";
import type { ChecksSliceProblem, MisnamedRuleId } from "../../infrastructure/engines/protocol/checks/checks-runner-types.ts";
import type { Hit } from "../../infrastructure/engines/protocol/runner-module/runner-result-schema.ts";
import type { Debt, PlacedRecord, RecordsReading, RefusedRecord } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { TouchedSet } from "./touched-set/touched-set.ts";
import { editionSchema } from "../../infrastructure/content-files/edition.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { EngineRun } from "../../infrastructure/engines/protocol/engine-run/engine-run.ts";
import { type RunReportRequest, runReportOf } from "./run-report-of.ts";

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

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

const LOCATION_FILE = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

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
    const missingSlice: ChecksSliceProblem = { slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "missing" };
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
  it("lists the checks of the clauses marked not-adopted, not-run or left unlisted, the editions ran, the excluded paths and the settings notes", () => {
    expect(
      runReportOf({
        ...REQUEST,
        selection: {
          selected: [],
          uncovered: [CLOCK_SOURCES],
          notAdopted: [CAST_EXPRESSIONS],
          notRun: [TEST_BODY_LOGIC],
          editions: [{ address: CAST_EXPRESSIONS, mechanism: ESLINT, edition: editionSchema.parse("1"), latest: editionSchema.parse("2") }],
        },
        excluded: [repoPathSchema.parse("dist")],
        notes: [{ kind: "declared-not-read", key: "layers" }],
      }),
    ).toEqual({
      ...EMPTY_REPORT,
      excluded: ["dist"],
      "not-adopted": [CAST_CHECK],
      "not-run": [TEST_BODY_CHECK],
      editions: [{ check: CAST_CHECK, engine: ESLINT_ENGINE, edition: "1", latest: "2" }],
      uncovered: [CLOCK_CHECK],
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
