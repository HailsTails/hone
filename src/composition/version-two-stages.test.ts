import { describe, expect, it, vi } from "vitest";

import type { LoadedEngine, NamedEnginePort } from "../application/ports/engine/engine-port.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { SettingsSources, SettingsSourcesOf } from "../application/ports/settings-sources.ts";
import type { NamedSettingsReading } from "../application/run/settings/read-settings.ts";
import type { EngineStageRequest, VersionTwoStages } from "../application/run/version-two-run.ts";
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
} from "../domain/language-layer/symptom-catalogue.ts";
import type { RecordsReading, SymptomReach } from "../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../domain/rule-set/edition-of.ts";
import { DEFAULT_CONVENTIONS } from "../domain/settings/conventions.ts";
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";
import { createRecordsFolder } from "../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import {
  createChildMeasuredStagesOver,
  mapEngineStageToEnginesRequest,
  type VersionTwoLocations,
  type VersionTwoPorts,
  versionTwoStagesOver,
} from "./version-two-stages.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

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

const REPO = absoluteRootOf("/repo");

const INSTALL = absoluteRootOf("/install");

const NOTHING_PRESENT: Pick<FileTextPort, "exists" | "read"> = {
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({
    outcome: "failed",
    error: {
      kind: "unreadable",
      path: "/install/src/infrastructure/disciplines-file/version-one-names.json",
      detail: "ENOENT",
    },
  }),
};

const gitListing = (request: { readonly tracked: GitPort["trackedPaths"] }): GitPort => ({
  trackedPaths: request.tracked,
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi
    .fn<GitPort["renamedSince"]>()
    .mockReturnValue({ outcome: "ok", value: new Map() }),
});

const portsOver = (request: { readonly git: GitPort }): VersionTwoPorts => ({
  fileText: { ...NOTHING_PRESENT, write: vi.fn<FileTextPort["write"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  namedEngine: { load: vi.fn() },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: request.git,
  gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
  directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
  recordsSourceOf: createRecordsFolder,
  settingsSourcesOf: createSettingsSources,
});

const GIT_LISTING_NOTHING = gitListing({
  tracked: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [] }),
});

const stagesOver = (request: {
  readonly git: GitPort;
  readonly baseRevision: string | undefined;
}) =>
  versionTwoStagesOver({
    ports: portsOver(request),
    locations: {
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      baseRevision: request.baseRevision,
    },
  });

const SETTINGS: NamedSettingsReading = {
  available: [],
  selection: {
    selected: [],
    notAdopted: [],
    notRun: [],
    excluded: [],
    eslintConfigRoots: [],
  },
  runSettings: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  eslintProjectionKind: "mjs",
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

describe("mapEngineStageToEnginesRequest", () => {
  it("hands the engines the stage's checks, with their symptoms' titles, and the files its records answer, alongside the ports and locations", () => {
    const stage = {
      catalogue: REPORT_CATALOGUE,
      settings: SETTINGS,
      records: {
        records: [
          {
            place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: WHOLE_SYMPTOM,
              file: repoPathOf("src/clock.ts"),
              holding: { held: "stated" },
            },
          },
        ],
      },
      tree: { tracked: [], declaredConfigRoots: [] },
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
      ],
    } satisfies EngineStageRequest;
    const ports = {
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
      modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
      namedEngine: { load: vi.fn() },
    };

    const mapped = mapEngineStageToEnginesRequest({
      ports,
      locations: { repoRoot: REPO, installRoot: INSTALL, moduleExtension: ".ts" },
      stage,
    });

    expect(mapped).toEqual({
      ...stage,
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      path: ports.path,
      modules: ports.modules,
      engine: ports.namedEngine,
      answered: [
        { ruleSet: TOOL_RULE_SET, symptom: "claimed-type", file: repoPathOf("src/clock.ts") },
      ],
    });
  });
});

describe("versionTwoStagesOver", () => {
  it("runs the selected Walker check over the tracked TypeScript file", async () => {
    const run = vi.fn<LoadedEngine["run"]>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "tool-failed", detail: "stopped" },
      },
    });
    const load = vi.fn<NamedEnginePort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: { run, project: async () => ({ outcome: "ok", value: [] }) },
    });
    const stages = versionTwoStagesOver({
      ports: { ...portsOver({ git: GIT_LISTING_NOTHING }), namedEngine: { load } },
      locations: {
        repoRoot: REPO,
        installRoot: INSTALL,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    });

    const outcome = await stages.engines({
      catalogue: REPORT_CATALOGUE,
      settings: {
        selection: {
          selected: [
            {
              binding: {
                engine: "walker",
                address: "date-used-directly#clock-sources",
                ruleSet: TOOL_RULE_SET,
                anchor: { kind: "file" },
                pieceRoot: "/install/pieces",
                checkSettings: {},
                edition: editionOf("1"),
                settings: {},
              },
            },
          ],
        },
        eslintConfigLookup: { lookup: "detected" },
        eslintProjectionKind: "mjs",
        conventions: DEFAULT_CONVENTIONS,
      },
      records: { records: [] },
      tree: { tracked: [repoPathOf("src/clock.ts")], declaredConfigRoots: [] },
      checks: [{ name: "clock-sources", symptom: DATE_USED_DIRECTLY, engines: [WALKER] }],
    });

    expect(outcome.outcome).toBe("failed");
    expect(run.mock.calls).toMatchObject([
      [{ checks: [{ name: "clock-sources" }], files: ["src/clock.ts"] }],
    ]);
  });

  it("fails as a catalogue not read, absent, when the install holds nothing", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).catalogue()).toEqual({
      outcome: "failed",
      error: {
        kind: "catalogue-not-read",
        path: "/install/rules",
        reason: { reason: "absent" },
      },
    });
  });

  it("fails as config absent when the repository holds no hone.config.json", () => {
    expect(
      stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).settings({
        catalogue: REPORT_CATALOGUE,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "config-absent", repo: "/repo" },
    });
  });

  it("reads the settings through the settings sources it is handed, over the repository and install", () => {
    const ports = portsOver({ git: GIT_LISTING_NOTHING });
    const settingsSourcesOf = vi.fn<SettingsSourcesOf>().mockReturnValue({
      settingsFile: vi.fn<SettingsSources["settingsFile"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "selection-absent", repo: "/repo" },
      }),
      ruleSetRoot: vi.fn<SettingsSources["ruleSetRoot"]>(),
      catalogue: vi.fn<SettingsSources["catalogue"]>(),
    });
    const stages = versionTwoStagesOver({
      ports: { ...ports, settingsSourcesOf },
      locations: {
        repoRoot: REPO,
        installRoot: INSTALL,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    });
    expect(stages.settings({ catalogue: REPORT_CATALOGUE })).toEqual({
      outcome: "failed",
      error: { kind: "config-absent", repo: "/repo" },
    });
    expect(settingsSourcesOf).toHaveBeenCalledExactlyOnceWith({
      fileText: ports.fileText,
      directory: ports.directory,
      path: ports.path,
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      toolRecordKinds: REPORT_CATALOGUE.recordKinds,
    });
  });

  it("reads no records, and says no base revision was given, when the repository holds no hone-records folder and none was passed", () => {
    expect(
      stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).records({
        catalogue: REPORT_CATALOGUE,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [],
        refused: [],
        notes: [],
        base: { measured: "no", base: { state: "not-given" } },
      },
    });
  });

  it("fails as a git failure when git cannot list the tracked files", () => {
    const failing = gitListing({
      tracked: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" },
      }),
    });
    expect(
      stagesOver({ git: failing, baseRevision: undefined }).tree({ settings: SETTINGS }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "git ls-files: not a repository" },
    });
  });

  it("asks git once for the renames since the base revision", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    vi.mocked(git.renamedSince).mockReturnValue({
      outcome: "ok",
      value: new Map([
        [
          repoPathOf("src/cart.ts"),
          { basePath: repoPathOf("src/basket.ts"), content: "unchanged" },
        ],
      ]),
    });
    expect(stagesOver({ git, baseRevision: "origin/main" }).renamed()).toEqual({
      measured: "yes",
      renamed: new Map([
        [
          repoPathOf("src/cart.ts"),
          { basePath: repoPathOf("src/basket.ts"), content: "unchanged" },
        ],
      ]),
    });
    expect(git.renamedSince).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO,
      baseRevision: "origin/main",
    });
  });

  it("touches nothing when no record is debt, without asking git", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    const records: RecordsReading = {
      records: [],
      refused: [],
      notes: [],
      base: { measured: "yes", held: [], placements: [] },
    };
    expect(
      stagesOver({ git, baseRevision: "origin/main" }).touched({
        scope: { baseScope: "merge-base", measuring: "when-debt-held" },
        records,
        renamed: { measured: "yes", renamed: new Map() },
      }),
    ).toEqual({ measured: "yes", paths: new Set() });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([]);
  });

  it("measures the files changed since the base revision when a record is debt", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    vi.mocked(git.changedSince).mockReturnValue({ outcome: "ok", value: [repoPathOf("src/a.ts")] });
    const records: RecordsReading = {
      records: [
        {
          place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
          record: {
            kind: "debt",
            symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
            reach: WHOLE_SYMPTOM,
            file: repoPathOf("src/a.ts"),
            holding: { held: "stated" },
          },
        },
      ],
      refused: [],
      notes: [],
      base: { measured: "yes", held: [], placements: [] },
    };
    expect(
      stagesOver({ git, baseRevision: "origin/main" }).touched({
        scope: { baseScope: "merge-base", measuring: "when-debt-held" },
        records,
        renamed: { measured: "yes", renamed: new Map() },
      }),
    ).toEqual({
      measured: "yes",
      paths: new Set([repoPathOf("src/a.ts")]),
    });
  });
});

describe("createChildMeasuredStagesOver", () => {
  it("builds the engines stage over the run's locations", async () => {
    const engines = vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "config-absent", repo: REPO },
    });
    const createEngines = vi
      .fn<
        (
          locations: VersionTwoLocations & { readonly path: PathPort },
        ) => VersionTwoStages["engines"]
      >()
      .mockReturnValue(engines);
    const ports = portsOver({ git: GIT_LISTING_NOTHING });
    const childMeasuredStagesOver = createChildMeasuredStagesOver({ createEngines });
    const stages = childMeasuredStagesOver({
      ports,
      locations: {
        repoRoot: REPO,
        installRoot: INSTALL,
        moduleExtension: ".ts",
        baseRevision: "origin/main",
      },
    });

    const runs = await stages.engines({
      catalogue: REPORT_CATALOGUE,
      settings: SETTINGS,
      records: { records: [] },
      tree: { tracked: [], declaredConfigRoots: [] },
      checks: [],
    });

    expect(runs).toEqual({ outcome: "failed", error: { kind: "config-absent", repo: REPO } });
    expect(createEngines).toHaveBeenCalledExactlyOnceWith({
      path: ports.path,
      installRoot: INSTALL,
      repoRoot: REPO,
      moduleExtension: ".ts",
      baseRevision: "origin/main",
    });
  });
});
