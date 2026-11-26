import { assert, describe, expect, it, vi } from "vitest";

import type {
  Case,
  Check,
  Engine,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { RecordsReading } from "../../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import type { CheckHit } from "../../domain/runner/check-observations.ts";
import { DEFAULT_CONVENTIONS } from "../../domain/settings/conventions.ts";
import type { NamedEngineRun } from "../ports/engine/engine-run.ts";
import type { NamedSettingsReading } from "./settings/read-settings.ts";
import {
  measureEngines,
  settledCatalogueOf,
  type VersionTwoRequest,
  type VersionTwoStages,
  versionTwoRunOver,
} from "./version-two-run.ts";

const FILE_A = repoPathOf("src/a.ts");

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
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

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
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
      kind: AUTHORISED_LOCATION,
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
    { situation: "a schema proves the type", kind: AUTHORISED_LOCATION, binding: "check-and-file" },
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
  recordKinds: [AUTHORISED_LOCATION, DEBT],
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

const SETTINGS: NamedSettingsReading = {
  available: [],
  selection: {
    selected: [],
    notAdopted: [],
    notRun: [],
    excluded: [repoPathOf("dist")],
    eslintConfigRoots: [],
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  eslintProjectionKind: "mjs",
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = {
  records: [],
  refused: [],
  notes: [],
  base: { measured: "yes", held: [] },
};

const HIT: CheckHit = {
  check: "claimed-type#cast-expressions",
  file: FILE_A,
  anchor: { line: 4, column: 9 },
  snippet: "body as Event",
};

const RUN: NamedEngineRun = {
  mechanism: ESLINT,
  hits: [HIT],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  measured: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
};

const CATALOGUE_UNREAD: RunLoadFailure = {
  kind: "catalogue-not-read",
  path: "/install/rules/typescript/symptoms.json",
  reason: { reason: "absent" },
};

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi
    .fn<VersionTwoStages["catalogue"]>()
    .mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi
    .fn<VersionTwoStages["settings"]>()
    .mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi
    .fn<VersionTwoStages["tree"]>()
    .mockReturnValue({ outcome: "ok", value: { tracked: [FILE_A], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [RUN] }),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  renamed: vi
    .fn<VersionTwoStages["renamed"]>()
    .mockReturnValue({ measured: "yes", renamed: new Map() }),
  touched: vi
    .fn<VersionTwoStages["touched"]>()
    .mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

const NO_ARGUMENTS: VersionTwoRequest = {
  forfeiture: undefined,
  reportOutput: undefined,
  measuring: "when-debt-held",
};

describe("versionTwoRunOver", () => {
  it("reports the findings the engines raised, with the catalogue and the output the settings name", async () => {
    const run = await versionTwoRunOver({ stages: stagesGiving({}), arguments: NO_ARGUMENTS });
    expect(run).toMatchObject({
      outcome: "ok",
      value: {
        catalogue: REPORT_CATALOGUE,
        output: "actionable",
        report: {
          excluded: ["dist"],
          findings: [{ ...HIT, mechanism: ESLINT }],
          symptoms: [CLAIMED_TYPE],
        },
      },
    });
  });

  it("gives the ESLint projection kind the settings name", async () => {
    const settings = vi
      .fn<VersionTwoStages["settings"]>()
      .mockReturnValue({ outcome: "ok", value: { ...SETTINGS, eslintProjectionKind: "ts" } });

    const run = await versionTwoRunOver({
      stages: stagesGiving({ settings }),
      arguments: NO_ARGUMENTS,
    });

    expect(run).toMatchObject({ outcome: "ok", value: { projectionKind: "ts" } });
  });

  it("takes the report output and the forfeiture assessment the command line gave over the settings", async () => {
    const touched = vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "elsewhere" });
    const run = await versionTwoRunOver({
      stages: stagesGiving({ touched }),
      arguments: { forfeiture: "elsewhere", reportOutput: "counts", measuring: "when-debt-held" },
    });
    expect(run).toMatchObject({ outcome: "ok", value: { output: "counts" } });
    expect(touched.mock.calls).toEqual([
      [
        {
          assessment: { forfeiture: "elsewhere" },
          measuring: "when-debt-held",
          records: RECORDS,
          renamed: { measured: "yes", renamed: new Map() },
        },
      ],
    ]);
  });

  it("hands back the touched set it measured once, and the measuring it was asked for reaches the stage", async () => {
    const measured = { measured: "yes", paths: new Set([FILE_A]) } as const;
    const touched = vi.fn<VersionTwoStages["touched"]>().mockReturnValue(measured);
    const run = await versionTwoRunOver({
      stages: stagesGiving({ touched }),
      arguments: { ...NO_ARGUMENTS, measuring: "always" },
    });
    expect(run).toMatchObject({ outcome: "ok", value: { touched: measured } });
    expect(touched.mock.calls).toEqual([
      [
        {
          assessment: { forfeiture: "this-run" },
          measuring: "always",
          records: RECORDS,
          renamed: { measured: "yes", renamed: new Map() },
        },
      ],
    ]);
  });

  it("judges the records at the paths git moved them to, refusing each where it is held, and measures with the files as they are", async () => {
    const debtAtBase = {
      place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
      record: {
        kind: "debt",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
        reach: { reaches: "whole-symptom" },
        file: repoPathOf("src/basket.ts"),
        holding: { held: "stated" },
      },
    } as const;
    const onDisk: RecordsReading = {
      ...RECORDS,
      records: [debtAtBase],
      base: {
        measured: "yes",
        held: [debtAtBase.record],
      },
    };
    const stages = stagesGiving({
      records: vi
        .fn<VersionTwoStages["records"]>()
        .mockReturnValue({ outcome: "ok", value: onDisk }),
      renamed: vi.fn<VersionTwoStages["renamed"]>().mockReturnValue({
        measured: "yes",
        renamed: new Map([[FILE_A, { basePath: repoPathOf("src/basket.ts"), content: "edited" }]]),
      }),
      touched: vi
        .fn<VersionTwoStages["touched"]>()
        .mockReturnValue({ measured: "yes", paths: new Set([FILE_A]) }),
    });
    const run = await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS });
    assert(run.outcome === "ok", "the run completes");
    expect({
      moved: run.value.moved,
      forfeited: run.value.report.forfeited,
      refused: run.value.report.refused,
    }).toEqual({
      moved: [{ place: debtAtBase.place, file: FILE_A }],
      forfeited: [
        {
          place: debtAtBase.place,
          record: {
            kind: "debt",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
            reach: { reaches: "whole-symptom" },
            file: FILE_A,
            holding: { held: "stated" },
          },
        },
      ],
      refused: [
        { place: debtAtBase.place, refusals: [{ kind: "held-at-moved-path", movedTo: FILE_A }] },
      ],
    });
    expect(vi.mocked(stages.engines).mock.calls).toEqual([
      [
        {
          catalogue: REPORT_CATALOGUE,
          settings: SETTINGS,
          records: onDisk,
          tree: { tracked: [FILE_A], declaredConfigRoots: [] },
          checks: [
            {
              name: "clock-sources",
              symptom: {
                ruleSet: TOOL_RULE_SET,
                name: "date-used-directly",
                title: "Date used directly",
              },
              engines: [WALKER],
            },
            {
              name: "test-body",
              symptom: {
                ruleSet: TOOL_RULE_SET,
                name: "branch-in-a-test",
                title: "Branch in a test",
              },
              engines: [WALKER],
            },
            {
              name: "cast-expressions",
              symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type", title: "Claimed type" },
              engines: [ESLINT_ENGINE],
            },
          ],
        },
      ],
    ]);
  });

  it("asks the settings and the records with the catalogue, and the engines with everything read", async () => {
    const stages = stagesGiving({});
    await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS });
    expect({
      settings: vi.mocked(stages.settings).mock.calls,
      records: vi.mocked(stages.records).mock.calls,
      engines: vi.mocked(stages.engines).mock.calls,
    }).toEqual({
      settings: [[{ catalogue: REPORT_CATALOGUE }]],
      records: [[{ catalogue: REPORT_CATALOGUE }]],
      engines: [
        [
          {
            catalogue: REPORT_CATALOGUE,
            settings: SETTINGS,
            records: RECORDS,
            tree: { tracked: [FILE_A], declaredConfigRoots: [] },
            checks: [
              {
                name: "clock-sources",
                symptom: {
                  ruleSet: TOOL_RULE_SET,
                  name: "date-used-directly",
                  title: "Date used directly",
                },
                engines: [WALKER],
              },
              {
                name: "test-body",
                symptom: {
                  ruleSet: TOOL_RULE_SET,
                  name: "branch-in-a-test",
                  title: "Branch in a test",
                },
                engines: [WALKER],
              },
              {
                name: "cast-expressions",
                symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type", title: "Claimed type" },
                engines: [ESLINT_ENGINE],
              },
            ],
          },
        ],
      ],
    });
  });

  it("fails naming the symptom a check names and no catalogue holds, and runs no engine", async () => {
    const stages = stagesGiving({
      catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({
        outcome: "ok",
        value: {
          principles: [],
          rules: [],
          cases: [],
          recipes: [],
          recordKinds: [],
          engines: [WALKER],
          symptoms: [],
          clauses: [],
          checks: [
            {
              name: "clock-sources",
              symptom: { ruleSet: TOOL_RULE_SET, name: "date-used-directly" },
              page: "date-used-directly/clock-sources.md",
              engines: [WALKER],
              forms: [],
              findingSpecifics: [],
            },
          ],
          namedBans: [],
        },
      }),
    });

    const run = await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS });

    expect({ run, engines: vi.mocked(stages.engines).mock.calls }).toEqual({
      run: {
        outcome: "failed",
        error: {
          kind: "symptom-unheld",
          symptom: { ruleSet: TOOL_RULE_SET, name: "date-used-directly" },
        },
      },
      engines: [],
    });
  });

  it("fails with the catalogue's failure and reads nothing more when the catalogue cannot be read", async () => {
    const stages = stagesGiving({
      catalogue: vi
        .fn<VersionTwoStages["catalogue"]>()
        .mockReturnValue({ outcome: "failed", error: CATALOGUE_UNREAD }),
    });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({
      outcome: "failed",
      error: CATALOGUE_UNREAD,
    });
    expect(vi.mocked(stages.settings).mock.calls).toEqual([]);
  });

  it("fails with the settings' failure and runs no engine when the settings cannot be read", async () => {
    const stages = stagesGiving({
      settings: vi
        .fn<VersionTwoStages["settings"]>()
        .mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
    });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({
      outcome: "failed",
      error: SETTINGS_ABSENT,
    });
    expect(vi.mocked(stages.engines).mock.calls).toEqual([]);
  });

  it("fails with the records' failure when the records cannot be read", async () => {
    const refused: RunLoadFailure = {
      kind: "records-refused",
      refusals: [{ kind: "not-a-records-file", file: repoPathOf("hone-records/notes.txt") }],
    };
    const stages = stagesGiving({
      records: vi
        .fn<VersionTwoStages["records"]>()
        .mockReturnValue({ outcome: "failed", error: refused }),
    });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({
      outcome: "failed",
      error: refused,
    });
  });

  it("fails with the tree's failure and runs no engine when a declared config root holds no tracked file", async () => {
    const untracked: RunLoadFailure = {
      kind: "config-root-untracked",
      root: repoPathOf("packages/web"),
    };
    const stages = stagesGiving({
      tree: vi
        .fn<VersionTwoStages["tree"]>()
        .mockReturnValue({ outcome: "failed", error: untracked }),
    });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({
      outcome: "failed",
      error: untracked,
    });
    expect(vi.mocked(stages.engines).mock.calls).toEqual([]);
  });

  it("fails with the engines' failure", async () => {
    const failure: RunLoadFailure = {
      kind: "engine-failed",
      engine: { named: "mechanism", mechanism: "eslint" },
      failure: { kind: "tool-failed", detail: "ESLint could not check the file" },
    };
    const stages = stagesGiving({
      engines: vi
        .fn<VersionTwoStages["engines"]>()
        .mockResolvedValue({ outcome: "failed", error: failure }),
    });
    expect(await versionTwoRunOver({ stages, arguments: NO_ARGUMENTS })).toEqual({
      outcome: "failed",
      error: failure,
    });
  });
});

describe("measureEngines", () => {
  it("hands back the engines' runs with everything it read to run them, and asks no touched set", async () => {
    const stages = stagesGiving({});

    const measured = await measureEngines({ stages });

    expect(measured).toEqual({
      outcome: "ok",
      value: {
        catalogue: REPORT_CATALOGUE,
        settings: SETTINGS,
        records: RECORDS,
        tree: { tracked: [FILE_A], declaredConfigRoots: [] },
        checks: [
          {
            name: "clock-sources",
            symptom: {
              ruleSet: TOOL_RULE_SET,
              name: "date-used-directly",
              title: "Date used directly",
            },
            engines: [WALKER],
          },
          {
            name: "test-body",
            symptom: {
              ruleSet: TOOL_RULE_SET,
              name: "branch-in-a-test",
              title: "Branch in a test",
            },
            engines: [WALKER],
          },
          {
            name: "cast-expressions",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type", title: "Claimed type" },
            engines: [ESLINT_ENGINE],
          },
        ],
        content: {
          symptoms: new Map([
            ["date-used-directly", DATE_USED_DIRECTLY],
            ["branch-in-a-test", BRANCH_IN_A_TEST],
            ["claimed-type", CLAIMED_TYPE],
          ]),
        },
        runs: [RUN],
      },
    });
    expect(vi.mocked(stages.touched).mock.calls).toEqual([]);
  });

  it("fails with the engines' failure", async () => {
    const failure: RunLoadFailure = {
      kind: "engine-failed",
      engine: { named: "mechanism", mechanism: "eslint" },
      failure: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
    };
    const stages = stagesGiving({
      engines: vi
        .fn<VersionTwoStages["engines"]>()
        .mockResolvedValue({ outcome: "failed", error: failure }),
    });

    const measured = await measureEngines({ stages });

    expect(measured).toEqual({ outcome: "failed", error: failure });
  });
});

describe("settledCatalogueOf", () => {
  it("holds a team's symptoms and checks beside Hone's, and reads no records", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamSymptom: Symptom = { ...CLAIMED_TYPE, ruleSet: acme, name: "team-cast" };
    const teamCatalogue: SymptomCatalogue = {
      ...REPORT_CATALOGUE,
      symptoms: [teamSymptom],
      checks: [],
    };
    const stages = stagesGiving({
      settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({
        outcome: "ok",
        value: { ...SETTINGS, externalCatalogues: [{ ruleSet: acme, catalogue: teamCatalogue }] },
      }),
    });
    expect(settledCatalogueOf({ stages })).toMatchObject({
      outcome: "ok",
      value: { catalogue: { symptoms: [...REPORT_CATALOGUE.symptoms, teamSymptom] } },
    });
    expect(vi.mocked(stages.records).mock.calls).toEqual([]);
  });
});
