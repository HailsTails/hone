import { describe, expect, it, vi } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../../tests/settings-catalogue.ts";
import type { ConsumerSelectionFile } from "../../../infrastructure/disciplines-file/selection-file.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { TOOL_RULE_SET } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { HeadRecord } from "../../../infrastructure/discipline-exceptions-folder/head-records.ts";
import type { FileCarveOutRecord } from "../record-answers/record-answer-oracle.ts";
import type { RecordInput } from "../../../infrastructure/hone-records-folder/records-mapping.ts";
import { type ProjectionFilesOf, type UpgradePlanRequest, upgradePlanOf, type VersionOneReading } from "./upgrade-plan.ts";

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: { ...SETTINGS_CATALOGUE, checks: [LOOP_KEYWORD_LOOPS] } }];

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const CARVE_OUT: FileCarveOutRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const CARVE_OUT_HEAD: HeadRecord = {
  kind: "file-carve-out",
  record: CARVE_OUT,
  entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
};

const READING: VersionOneReading = { selection: SELECTION, heads: [CARVE_OUT_HEAD] };

const FINDINGS_ON_LOOPS = { kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } } as const;

const CARVE_OUT_INPUT: RecordInput = { ...CARVE_OUT_HEAD, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } };

const PLANNED_SETTINGS = {
  file: "hone.config.json",
  text: '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "loop-keyword#loops": "walker"\n  }\n}\n',
};

const PLANNED_SETTINGS_WITH_PACKAGE_ROOT =
  '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "loop-keyword#loops": "walker"\n  },\n  "eslintConfigRoots": [\n    "packages/a"\n  ]\n}\n';

const PLANNED_DEBT = {
  file: "hone-records/debt/loop-keyword.json",
  text: '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "loop-keyword#loops",\n      "file": "src/a.ts",\n      "note": "legacy loop"\n    }\n  ]\n}\n',
};

const PLANNED_SETTINGS_MARKING_TEST_BODY = { file: "hone.config.json", text: '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "loop-keyword#loops": "walker",\n    "loop-keyword#test-body": "not-adopted",\n    "rebinding#test-body": "not-adopted"\n  }\n}\n' };

const LOOPS_SETTINGS = {
  exclude: [],
  ruleSets: [],
  checks: [{ address: { ruleSet: "hone", check: "loop-keyword#loops" }, state: { state: "run", engine: "walker" } }],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: { conventions: { generated: [], layers: [] }, declared: [] },
};

const PLANNED_PROJECTION = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "projection text" };

const projecting = (request: { readonly files: readonly (typeof PLANNED_PROJECTION)[] }) =>
  vi.fn<ProjectionFilesOf>().mockResolvedValue({ outcome: "ok", value: { files: request.files, projections: request.files } });

const requestOver =(overrides: Partial<UpgradePlanRequest>): UpgradePlanRequest => ({
  reading: READING,
  answered: [FINDINGS_ON_LOOPS],
  catalogues: CATALOGUES,
  projectionFilesOf: projecting({ files: [PLANNED_PROJECTION] }),
  ...overrides,
});

describe("upgradePlanOf", () => {
  it("plans the settings, the debt records and the projection for a repository that carries over, naming the projection it planned", async () => {
    await expect(upgradePlanOf(requestOver({}))).resolves.toEqual({
      outcome: "ok",
      value: { markedNotAdopted: [], inputs: [CARVE_OUT_INPUT], files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION], projected: [PLANNED_PROJECTION] },
    });
  });

  it("plans the checks of an unselected discipline that share a symptom with a selected one as not-adopted, and names them", async () => {
    await expect(upgradePlanOf(requestOver({ catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }] }))).resolves.toEqual({
      outcome: "ok",
      value: {
        markedNotAdopted: [
          { check: { ruleSet: "hone", check: "loop-keyword#test-body" }, clause: TEST_BODY_CLAUSE, reason: "discipline-not-selected" },
          { check: { ruleSet: "hone", check: "rebinding#test-body" }, clause: TEST_BODY_CLAUSE, reason: "discipline-not-selected" },
        ],
        inputs: [CARVE_OUT_INPUT],
        files: [PLANNED_SETTINGS_MARKING_TEST_BODY, PLANNED_DEBT, PLANNED_PROJECTION],
        projected: [PLANNED_PROJECTION],
      },
    });
  });

  it("carries the declared eslintConfigRoots into the settings it plans, and into the settings the projection is asked over", async () => {
    const projectionFilesOf = projecting({ files: [PLANNED_PROJECTION] });
    const planned = await upgradePlanOf(requestOver({ projectionFilesOf, reading: { ...READING, selection: { ...SELECTION, eslintConfigRoots: [repoPathSchema.parse("packages/a")] } } }));
    expect(planned).toEqual({
      outcome: "ok",
      value: {
        markedNotAdopted: [],
        inputs: [CARVE_OUT_INPUT],
        files: [{ file: "hone.config.json", text: PLANNED_SETTINGS_WITH_PACKAGE_ROOT }, PLANNED_DEBT, PLANNED_PROJECTION],
        projected: [PLANNED_PROJECTION],
      },
    });
    expect(projectionFilesOf).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ settings: expect.objectContaining({ eslintConfigRoots: ["packages/a"] }) }));
  });

  it("asks for the projection files over the settings and the record documents it planned", async () => {
    const projectionFilesOf = projecting({ files: [PLANNED_PROJECTION] });
    await upgradePlanOf(requestOver({ projectionFilesOf }));
    expect(projectionFilesOf).toHaveBeenCalledExactlyOnceWith({
      settings: LOOPS_SETTINGS,
      documents: [{ file: "hone-records/debt/loop-keyword.json", version: 2, records: [{ answers: "loop-keyword#loops", file: "src/a.ts", note: "legacy loop" }] }],
    });
  });

  it("plans no projection file when the engines project none", async () => {
    await expect(upgradePlanOf(requestOver({ projectionFilesOf: projecting({ files: [] }) }))).resolves.toEqual({
      outcome: "ok",
      value: { markedNotAdopted: [], inputs: [CARVE_OUT_INPUT], files: [PLANNED_SETTINGS, PLANNED_DEBT], projected: [] },
    });
  });

  it("refuses when the projection could not be made", async () => {
    const failed = vi.fn<ProjectionFilesOf>().mockResolvedValue({ outcome: "failed", error: { kind: "projection-failed", failure: { kind: "unknown-check", check: "names#names" } } });
    await expect(upgradePlanOf(requestOver({ projectionFilesOf: failed }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-failed", failure: { kind: "unknown-check", check: "names#names" } },
    });
  });

  it("refuses a file carve-out the oracle gave no answer for", async () => {
    await expect(upgradePlanOf(requestOver({ answered: [] }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "carve-out-unanswered", clause: "CD-15#loops", file: "src/a.ts" },
    });
  });

  it("refuses an authorised location the oracle gave no answer for", async () => {
    const location: Extract<ExceptionRecord, { readonly kind: "authorised-location" }> = {
      kind: "authorised-location",
      clause: LOOPS_CLAUSE,
      mechanism: AUDIT,
      file: SRC_A,
      reason: "kept",
    };
    const head: HeadRecord = { kind: "authorised-location", record: location, entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" } };
    await expect(upgradePlanOf(requestOver({ reading: { ...READING, heads: [head] }, answered: [] }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "location-unanswered", clause: "CD-15#loops", file: "src/a.ts" },
    });
  });

  it("refuses with the mapping's own refusals when a carve-out answered nothing", async () => {
    await expect(upgradePlanOf(requestOver({ answered: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } }] }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "mapping-refused", refusals: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: "src/a.ts", credited: "nothing" }] },
    });
  });

});
