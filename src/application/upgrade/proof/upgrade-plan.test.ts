import { describe, expect, it, vi } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
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
import {
  type PlannedProjection,
  type ProjectionFilesOf,
  type UpgradePlanRequest,
  upgradePlanOf,
} from "./upgrade-plan.ts";

const AUDIT = "walker" as const;

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

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
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
  findingSpecifics: [],
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
          { form: "a-for-loop", symptom: LOOP_KEYWORD },
          { form: "a-let", symptom: REBINDING },
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
  eslintProjectionKind: "mjs",
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

const PROJECTION_PLAN: PlannedProjection = {
  entries: [{ ...PLANNED_PROJECTION, kind: "write" }],
  projections: [PLANNED_PROJECTION],
};

const projecting = (value: PlannedProjection) =>
  vi.fn<ProjectionFilesOf>().mockResolvedValue({ outcome: "ok", value });

const requestOver = (overrides: Partial<UpgradePlanRequest>): UpgradePlanRequest => ({
  reading: READING,
  answered: [FINDINGS_ON_LOOPS],
  catalogues: CATALOGUES,
  projectionFilesOf: projecting(PROJECTION_PLAN),
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

const OUTSIDE_IMPORT: Symptom = {
  ...LOOP_KEYWORD,
  name: "outside-import-past-a-boundary",
  title: "Outside import past a boundary",
  correctUses: [
    {
      situation: "the adapter for that outside party",
      kind: AUTHORISED_LOCATION_KIND,
      binding: "check-file-and-outside-party",
    },
  ],
};

const IMPORTS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-19"),
  clause: clauseIdOf("import-boundaries"),
};

const IMPORT_CATALOGUES: readonly RuleSetCatalogue[] = [
  {
    ruleSet: TOOL_RULE_SET,
    catalogue: {
      ...SETTINGS_CATALOGUE,
      symptoms: [OUTSIDE_IMPORT],
      clauses: [
        { clause: IMPORTS_CLAUSE, sight: { kind: "one-symptom", symptom: OUTSIDE_IMPORT } },
      ],
      checks: [
        {
          name: "import-or-require",
          symptom: OUTSIDE_IMPORT,
          page: "outside-import-past-a-boundary/import-or-require.md",
          clause: IMPORTS_CLAUSE,
          engines: [ESLINT_ENGINE],
          forms: [],
          findingSpecifics: ["outside-party"],
        },
      ],
    },
  },
];

const IDS_LOCATION: Extract<ExceptionRecord, { readonly kind: "authorised-location" }> = {
  kind: "authorised-location",
  clause: IMPORTS_CLAUSE,
  mechanism: "eslint",
  file: repoPathOf("src/adapters/ids.ts"),
  reason: "the ids adapter",
};

const IDS_ENTRY = {
  kind: "authorised-location",
  clause: "CD-19#import-boundaries",
  file: "src/adapters/ids.ts",
  reason: "the ids adapter",
} as const;

describe("upgradePlanOf", () => {
  it("plans a clause-wide carve-out with its check running and its settings kept, and the file carve-out on its clause as debt", async () => {
    const settingsFormat = settingsFormatWriting();

    const planned = await upgradePlanOf(
      requestOver({
        settingsFormat,
        reading: {
          selection: { ...SELECTION, clauseSettings: [[LOOPS_CLAUSE, { edition: "1" }]] },
          heads: [CLAUSE_WIDE_HEAD, CARVE_OUT_HEAD],
        },
      }),
    );

    expect({ planned, written: vi.mocked(settingsFormat.textOf).mock.calls }).toEqual({
      planned: {
        outcome: "ok",
        value: {
          inputs: [CLAUSE_WIDE_HEAD, CARVE_OUT_INPUT],
          lines: [
            {
              recordKind: "clause-wide-carve-out",
              clause: LOOPS_CLAUSE,
              newKind: "debt-by-file",
              reason: "generated code",
              owner: "the team",
            },
            DEBT_LINE,
          ],
          files: [PLANNED_SETTINGS, PLANNED_DEBT],
          projected: [PLANNED_PROJECTION],
          projectionEntries: [{ ...PLANNED_PROJECTION, kind: "write" }],
        },
      },
      written: [
        [
          {
            settings: {
              ...LOOPS_SETTINGS,
              checkSettings: [
                {
                  address: { ruleSet: "hone", check: "loop-keyword#loops" },
                  values: { edition: "1" },
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
          files: [PLANNED_SETTINGS, PLANNED_DEBT],
          projected: [PLANNED_PROJECTION],
          projectionEntries: [{ ...PLANNED_PROJECTION, kind: "write" }],
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
          files: [PLANNED_SETTINGS, PLANNED_DEBT],
          projected: [PLANNED_PROJECTION],
          projectionEntries: [{ ...PLANNED_PROJECTION, kind: "write" }],
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
    const projectionFilesOf = projecting(PROJECTION_PLAN);
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
          files: [PLANNED_SETTINGS, PLANNED_DEBT],
          projected: [PLANNED_PROJECTION],
          projectionEntries: [{ ...PLANNED_PROJECTION, kind: "write" }],
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
    const projectionFilesOf = projecting(PROJECTION_PLAN);
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

  it("carries a CD-19 authorised location as one record for each package its clause confined, then one for node modules", async () => {
    const idsRecord = {
      answers: "outside-import-past-a-boundary#import-or-require",
      file: "src/adapters/ids.ts",
      carried: IDS_ENTRY,
    };
    const projectionFilesOf = projecting({ entries: [], projections: [] });
    await upgradePlanOf(
      requestOver({
        projectionFilesOf,
        catalogues: IMPORT_CATALOGUES,
        reading: {
          selection: {
            ...SELECTION,
            clauses: [[IMPORTS_CLAUSE, { state: "run", mechanism: "eslint" }]],
            clauseSettings: [[IMPORTS_CLAUSE, { confinedPackages: ["uuid", "zod"] }]],
          },
          heads: [{ kind: "authorised-location", record: IDS_LOCATION, entry: IDS_ENTRY }],
        },
        answered: [
          { kind: "authorised-location", record: IDS_LOCATION, answer: { reach: "whole-clause" } },
        ],
      }),
    );
    expect(projectionFilesOf).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        documents: [
          {
            file: "hone-records/authorised-locations/outside-import-past-a-boundary.json",
            version: 2,
            records: [
              { ...idsRecord, outsideParty: "uuid" },
              { ...idsRecord, outsideParty: "zod" },
              { ...idsRecord, outsideParty: "node:" },
            ],
          },
        ],
      }),
    );
  });

  it("refuses to plan when the packages CD-19 confines are not package names", async () => {
    const request = requestOver({
      projectionFilesOf: projecting({ entries: [], projections: [] }),
      catalogues: IMPORT_CATALOGUES,
      reading: {
        selection: {
          ...SELECTION,
          clauses: [[IMPORTS_CLAUSE, { state: "run", mechanism: "eslint" }]],
          clauseSettings: [[IMPORTS_CLAUSE, { confinedPackages: [""] }]],
        },
        heads: [{ kind: "authorised-location", record: IDS_LOCATION, entry: IDS_ENTRY }],
      },
      answered: [
        { kind: "authorised-location", record: IDS_LOCATION, answer: { reach: "whole-clause" } },
      ],
    });

    const plan = await upgradePlanOf(request);

    expect(plan).toEqual({
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [{ kind: "confined-packages-unreadable", clause: "CD-19#import-boundaries" }],
      },
    });
  });

  it("plans no projection file when the engines project none", async () => {
    await expect(
      upgradePlanOf(
        requestOver({ projectionFilesOf: projecting({ entries: [], projections: [] }) }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        inputs: [CARVE_OUT_INPUT],
        lines: [DEBT_LINE],
        files: [PLANNED_SETTINGS, PLANNED_DEBT],
        projected: [],
        projectionEntries: [],
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

  it("refuses with the mapping's own refusal when an authorised location is at a check whose symptom no catalogue holds", async () => {
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
    const symptomUnheldCatalogues: readonly RuleSetCatalogue[] = [
      {
        ruleSet: TOOL_RULE_SET,
        catalogue: { ...SETTINGS_CATALOGUE, symptoms: [REBINDING], checks: [LOOP_KEYWORD_LOOPS] },
      },
    ];

    const planned = await upgradePlanOf(
      requestOver({
        catalogues: symptomUnheldCatalogues,
        reading: { ...READING, heads: [head] },
        answered: [
          { kind: "authorised-location", record: location, answer: { reach: "whole-clause" } },
        ],
      }),
    );

    expect(planned).toEqual({
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [{ kind: "symptom-unheld", symptom: LOOP_KEYWORD_LOOPS.symptom }],
      },
    });
  });

  it("refuses with the settings, confined packages and records refusals together, in that order", async () => {
    const location: Extract<ExceptionRecord, { readonly kind: "authorised-location" }> = {
      kind: "authorised-location",
      clause: LOOPS_CLAUSE,
      mechanism: AUDIT,
      file: SRC_A,
      reason: "kept",
    };
    const request = requestOver({
      catalogues: [
        {
          ruleSet: TOOL_RULE_SET,
          catalogue: { ...SETTINGS_CATALOGUE, symptoms: [REBINDING], checks: [LOOP_KEYWORD_LOOPS] },
        },
      ],
      reading: {
        selection: {
          ...SELECTION,
          clauses: [
            [LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }],
            [LAYERING_CLAUSE, { state: "run", mechanism: AUDIT }],
          ],
          clauseSettings: [[LAYERING_CLAUSE, { confinedPackages: [""] }]],
        },
        heads: [
          {
            kind: "authorised-location",
            record: location,
            entry: {
              kind: "authorised-location",
              clause: "CD-15#loops",
              file: "src/a.ts",
              reason: "kept",
            },
          },
        ],
      },
      answered: [
        { kind: "authorised-location", record: location, answer: { reach: "whole-clause" } },
      ],
    });

    const plan = await upgradePlanOf(request);

    expect(plan).toEqual({
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [
          { kind: "clause-without-check", clause: "CD-13#layering" },
          { kind: "confined-packages-unreadable", clause: "CD-13#layering" },
          { kind: "symptom-unheld", symptom: LOOP_KEYWORD_LOOPS.symptom },
        ],
      },
    });
  });

  it("refuses with both the settings' and the records' own refusals when an authorised location's clause has no check", async () => {
    const location = {
      kind: "authorised-location",
      clause: LOOPS_CLAUSE,
      mechanism: AUDIT,
      file: repoPathOf("src/a.ts"),
      reason: "the one place",
    } as const;
    const entry = {
      kind: "authorised-location",
      clause: "CD-15#loops",
      file: "src/a.ts",
      reason: "the one place",
    };

    const plan = await upgradePlanOf(
      requestOver({
        reading: {
          ...READING,
          heads: [{ kind: "authorised-location", record: location, entry }],
        },
        answered: [
          { kind: "authorised-location", record: location, answer: { reach: "whole-clause" } },
        ],
        catalogues: [],
      }),
    );

    expect(plan).toEqual({
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [
          { kind: "clause-without-check", clause: "CD-15#loops" },
          { kind: "clause-without-check", clause: "CD-15#loops" },
        ],
      },
    });
  });
});
