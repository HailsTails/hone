import { describe, expect, it, vi } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { HeadRecord } from "../../../domain/records/upgrade/head-records.ts";
import type { RecordInput } from "../../../domain/records/upgrade/records-mapping.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import type { FileCarveOutRecord } from "../../ports/upgrade/record-answer-oracle.ts";
import type { VersionOneReading } from "../../ports/upgrade/version-one-reading.ts";
import { type ProjectionFilesOf, type UpgradePlanRequest, upgradePlanOf } from "./upgrade-plan.ts";

const AUDIT = "walker" as const;

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

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

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
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

const CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: TOOL_RULE_SET, catalogue: { ...SETTINGS_CATALOGUE, checks: [LOOP_KEYWORD_LOOPS] } },
];

const SRC_A = repoPathOf("src/a.ts");

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

const CARVE_OUT: FileCarveOutRecord = {
  kind: "file-carve-out",
  clause: LOOPS_CLAUSE,
  mechanism: AUDIT,
  file: SRC_A,
  reason: "legacy loop",
};

const CARVE_OUT_HEAD: HeadRecord = {
  kind: "file-carve-out",
  record: CARVE_OUT,
  entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
};

const READING: VersionOneReading = { selection: SELECTION, heads: [CARVE_OUT_HEAD] };

const FINDINGS_ON_LOOPS = {
  kind: "file-carve-out",
  record: CARVE_OUT,
  answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
} as const;

const CARVE_OUT_INPUT: RecordInput = {
  ...CARVE_OUT_HEAD,
  answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
};

const DEBT_LINE = {
  recordKind: "file-carve-out",
  clause: LOOPS_CLAUSE,
  file: repoPathOf("src/a.ts"),
  newKind: "debt",
  check: LOOP_KEYWORD_LOOPS,
  holding: "stated",
} as const;

const SETTINGS_TEXT = "the settings format's text";

const PLANNED_SETTINGS = { file: "hone.config.json", text: SETTINGS_TEXT };

const settingsFormatWriting = (): Pick<SettingsFileFormat, "textOf"> => ({
  textOf: vi.fn<SettingsFileFormat["textOf"]>().mockReturnValue(SETTINGS_TEXT),
});

const PLANNED_DEBT = {
  file: "hone-records/debt/loop-keyword.json",
  text: '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "loop-keyword#loops",\n      "file": "src/a.ts",\n      "note": "legacy loop"\n    }\n  ]\n}\n',
};

const LOOPS_SETTINGS = {
  exclude: [],
  ruleSets: [],
  checks: [
    {
      address: { ruleSet: "hone", check: "loop-keyword#loops" },
      state: { state: "run", engine: "walker" },
    },
  ],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: {
    conventions: {
      generated: [],
      layers: [],
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    },
    declared: [],
  },
};

const PLANNED_PROJECTION = { file: repoPathOf("hone.eslint.mjs"), text: "projection text" };

const projecting = (request: { readonly files: readonly (typeof PLANNED_PROJECTION)[] }) =>
  vi.fn<ProjectionFilesOf>().mockResolvedValue({
    outcome: "ok",
    value: { files: request.files, projections: request.files },
  });

const requestOver = (overrides: Partial<UpgradePlanRequest>): UpgradePlanRequest => ({
  reading: READING,
  answered: [FINDINGS_ON_LOOPS],
  catalogues: CATALOGUES,
  projectionFilesOf: projecting({ files: [PLANNED_PROJECTION] }),
  settingsFormat: settingsFormatWriting(),
  ...overrides,
});

const CLAUSE_WIDE_WHY = {
  why: "a loop was written",
  because: "it was quicker",
  evidence: "the commit",
} as const;

const CLAUSE_WIDE_HEAD = {
  kind: "clause-wide-carve-out",
  record: {
    kind: "clause-wide-carve-out",
    clause: LOOPS_CLAUSE,
    mechanism: AUDIT,
    reason: "generated code",
    whyChain: {
      whys: [CLAUSE_WIDE_WHY, CLAUSE_WIDE_WHY, CLAUSE_WIDE_WHY, CLAUSE_WIDE_WHY, CLAUSE_WIDE_WHY],
      rootCause: "no rule at the time",
      owner: "the team",
    },
  },
} as const;

describe("upgradePlanOf", () => {
  it("plans a clause-wide carve-out as its check not adopted, with no record file", async () => {
    const settingsFormat = settingsFormatWriting();
    expect({
      planned: await upgradePlanOf(
        requestOver({
          settingsFormat,
          answered: [],
          reading: { selection: SELECTION, heads: [CLAUSE_WIDE_HEAD] },
        }),
      ),
      written: vi.mocked(settingsFormat.textOf).mock.calls,
    }).toEqual({
      planned: {
        outcome: "ok",
        value: {
          inputs: [CLAUSE_WIDE_HEAD],
          lines: [
            { recordKind: "clause-wide-carve-out", clause: LOOPS_CLAUSE, reason: "generated code" },
            {
              recordKind: "clause-wide-carve-out",
              clause: LOOPS_CLAUSE,
              newKind: "not-adopted",
              check: LOOP_KEYWORD_LOOPS,
            },
          ],
          files: [PLANNED_SETTINGS, PLANNED_PROJECTION],
          projected: [PLANNED_PROJECTION],
        },
      },
      written: [
        [
          {
            settings: {
              ...LOOPS_SETTINGS,
              checks: [
                {
                  address: { ruleSet: "hone", check: "loop-keyword#loops" },
                  state: { state: "not-adopted" },
                },
              ],
            },
          },
        ],
      ],
    });
  });

  it("plans the settings, the debt records and the projection for a repository that carries over, naming the projection it planned", async () => {
    const settingsFormat = settingsFormatWriting();
    expect({
      planned: await upgradePlanOf(requestOver({ settingsFormat })),
      written: vi.mocked(settingsFormat.textOf).mock.calls,
    }).toEqual({
      planned: {
        outcome: "ok",
        value: {
          inputs: [CARVE_OUT_INPUT],
          lines: [DEBT_LINE],
          files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION],
          projected: [PLANNED_PROJECTION],
        },
      },
      written: [[{ settings: LOOPS_SETTINGS }]],
    });
  });

  it("plans only the checks version 1 selected, leaving out the checks of an unselected discipline that share a symptom with a selected one", async () => {
    const settingsFormat = settingsFormatWriting();
    const planned = await upgradePlanOf(
      requestOver({
        settingsFormat,
        catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }],
      }),
    );
    expect({ planned, written: vi.mocked(settingsFormat.textOf).mock.calls }).toEqual({
      planned: {
        outcome: "ok",
        value: {
          inputs: [CARVE_OUT_INPUT],
          lines: [DEBT_LINE],
          files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION],
          projected: [PLANNED_PROJECTION],
        },
      },
      written: [
        [
          {
            settings: {
              ...LOOPS_SETTINGS,
              checks: [
                {
                  address: { ruleSet: "hone", check: "loop-keyword#loops" },
                  state: { state: "run", engine: "walker" },
                },
              ],
            },
          },
        ],
      ],
    });
  });

  it("carries the declared eslintConfigRoots into the settings it plans, and into the settings the projection is asked over", async () => {
    const projectionFilesOf = projecting({ files: [PLANNED_PROJECTION] });
    const settingsFormat = settingsFormatWriting();
    const planned = await upgradePlanOf(
      requestOver({
        projectionFilesOf,
        settingsFormat,
        reading: {
          ...READING,
          selection: { ...SELECTION, eslintConfigRoots: [repoPathOf("packages/a")] },
        },
      }),
    );
    expect({ planned, written: vi.mocked(settingsFormat.textOf).mock.calls }).toEqual({
      planned: {
        outcome: "ok",
        value: {
          inputs: [CARVE_OUT_INPUT],
          lines: [DEBT_LINE],
          files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION],
          projected: [PLANNED_PROJECTION],
        },
      },
      written: [[{ settings: { ...LOOPS_SETTINGS, eslintConfigRoots: ["packages/a"] } }]],
    });
    expect(projectionFilesOf).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        settings: expect.objectContaining({ eslintConfigRoots: ["packages/a"] }),
      }),
    );
  });

  it("asks for the projection files over the settings and the record documents it planned", async () => {
    const projectionFilesOf = projecting({ files: [PLANNED_PROJECTION] });
    await upgradePlanOf(requestOver({ projectionFilesOf }));
    expect(projectionFilesOf).toHaveBeenCalledExactlyOnceWith({
      settings: LOOPS_SETTINGS,
      documents: [
        {
          file: "hone-records/debt/loop-keyword.json",
          version: 2,
          records: [{ answers: "loop-keyword#loops", file: "src/a.ts", note: "legacy loop" }],
        },
      ],
    });
  });

  it("plans no projection file when the engines project none", async () => {
    await expect(
      upgradePlanOf(requestOver({ projectionFilesOf: projecting({ files: [] }) })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        inputs: [CARVE_OUT_INPUT],
        lines: [DEBT_LINE],
        files: [PLANNED_SETTINGS, PLANNED_DEBT],
        projected: [],
      },
    });
  });

  it("refuses when the projection could not be made", async () => {
    const failed = vi.fn<ProjectionFilesOf>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "projection-failed",
        failure: { kind: "unknown-check", check: "names#names" },
      },
    });
    await expect(upgradePlanOf(requestOver({ projectionFilesOf: failed }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "projection-failed",
        failure: { kind: "unknown-check", check: "names#names" },
      },
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
    const head: HeadRecord = {
      kind: "authorised-location",
      record: location,
      entry: {
        kind: "authorised-location",
        clause: "CD-15#loops",
        file: "src/a.ts",
        reason: "kept",
      },
    };
    await expect(
      upgradePlanOf(requestOver({ reading: { ...READING, heads: [head] }, answered: [] })),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "location-unanswered", clause: "CD-15#loops", file: "src/a.ts" },
    });
  });

  it("refuses with the mapping's own refusals when a carve-out answered nothing", async () => {
    await expect(
      upgradePlanOf(
        requestOver({
          answered: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } }],
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [
          {
            kind: "record-answers-nothing",
            clause: "CD-15#loops",
            file: "src/a.ts",
            credited: "nothing",
          },
        ],
      },
    });
  });
});
