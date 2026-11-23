import { describe, expect, it, vi } from "vitest";

import type { CommandRequest } from "../application/ports/command-request.ts";
import type { NamedEngineRun } from "../application/ports/engine/engine-run.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { ExceptionRepositoryOf } from "../application/ports/records/exception-repository.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import type { NamedSettingsReading } from "../application/run/settings/read-settings.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
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
} from "../domain/language-layer/symptom-catalogue.ts";
import type { RecordsReading } from "../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { RunReport } from "../domain/report/run-report.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { DEFAULT_CONVENTIONS } from "../domain/settings/conventions.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { VERSION_TWO_CHECK, versionTwoReportRequestOf } from "./check-command.ts";
import { commandOf } from "./composed-command.ts";
import type { VersionTwoRepositoryPorts } from "./version-two-repository.ts";
import type { StagesOver } from "./version-two-stages.ts";

const versionTwoCheckCommandOf =
  (ports: Omit<VersionTwoRepositoryPorts, keyof CommandRequest>) => (command: CommandRequest) =>
    commandOf({ tool: VERSION_TWO_CHECK, ports: { ...command, ...ports } })(command);

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

const ITEACH_OVER_TYPED_ROWS: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "iteach-over-typed-rows",
  title: "it.each over typed rows",
  standing: "accepted",
  reason: { text: "each row is a case", standing: "accepted" },
};

const BOUNDARY_RECORD_KIND: RecordKind = {
  name: "boundary-record",
  title: "Boundary record",
  phrase: "a boundary record",
  todaysFormat: "authorised-location",
};

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
    { situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" },
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
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
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
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
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
  symptom: DATE_USED_DIRECTLY,
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
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
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ section: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE_A = repoPathOf("src/a.ts");

const SETTINGS: NamedSettingsReading = {
  available: [],
  selection: {
    selected: [],
    notAdopted: [],
    notRun: [],
    excluded: [],
    eslintConfigRoots: [],
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const CLEAN_RUN: NamedEngineRun = {
  mechanism: ESLINT,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  measured: [],
  misnamedRuleIds: [],
};

const FAILING_RUN: NamedEngineRun = {
  ...CLEAN_RUN,
  hits: [
    {
      check: "claimed-type#cast-expressions",
      file: FILE_A,
      anchor: { line: 4, column: 9 },
      snippet: "body as Event",
    },
  ],
};

const SLICES_RUN: NamedEngineRun = {
  ...CLEAN_RUN,
  slices: [
    { slice: repoPathOf("packages/a/hone.eslint.mjs"), state: "missing" },
    { slice: repoPathOf("packages/b/hone.eslint.mjs"), state: "out-of-date" },
  ],
};

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
  engines: vi
    .fn<VersionTwoStages["engines"]>()
    .mockResolvedValue({ outcome: "ok", value: [CLEAN_RUN] }),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  touched: vi
    .fn<VersionTwoStages["touched"]>()
    .mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

const FAILING_REPORT = `findings (1)
claimed-type#cast-expressions eslint src/a.ts:4:9 body as Event symptom: claimed-type (../install/rules/typescript/symptoms.md#claimed-type) may indicate: declared-not-asserted
symptoms (1)
claimed-type: Claimed type. May indicate: gives a value its type: or needs it narrower → Declared, not asserted. The breach usually sits at the producer. Read ../install/rules/typescript/symptoms.md#claimed-type
verdict: fail
`;

const INSTALL_ROOT_LINE =
  "load failure: install-root-unresolvable https://example.com/tool-command.js the text is not a file: URL\n";

const ARGUMENTS_INVALID_LINE =
  "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n";

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const ENTRY_URL = "file:///install/src/hone.ts";

const commandWith = (request: {
  readonly process: ProcessPort;
  readonly moduleUrl: string;
}): CommandRequest & { readonly exceptionRepositoryOf: ExceptionRepositoryOf } => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unreadable", path: "/repo/package.json", detail: "absent" },
    }),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  moduleUrl: request.moduleUrl,
});

const stagesOverGiving = (request: { readonly stages: VersionTwoStages }) =>
  vi.fn<StagesOver>().mockReturnValue(request.stages);

const ranWith = async (request: {
  readonly arguments: readonly string[];
  readonly stagesOver: StagesOver;
  readonly moduleUrl: string;
}) => {
  const processPort = processWith({ arguments: request.arguments });
  await versionTwoCheckCommandOf({
    namedEngine: { load: vi.fn(), run: vi.fn(), project: vi.fn() },
    gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
    directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
    recordsSourceOf: vi.fn<RecordsSourceOf>(),
    stagesOver: request.stagesOver,
  })(commandWith({ process: processPort, moduleUrl: request.moduleUrl }));
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

const FAILING_STAGES = stagesGiving({
  engines: vi
    .fn<VersionTwoStages["engines"]>()
    .mockResolvedValue({ outcome: "ok", value: [FAILING_RUN] }),
});

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

describe("versionTwoCheckCommandOf", () => {
  it("prints the report's verdict and exits 0 when the run is clean", async () => {
    const ran = await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo"],
      stagesOver: stagesOverGiving({ stages: stagesGiving({}) }),
    });
    expect(ran).toEqual({ writes: [[{ text: "verdict: pass\n" }]], exits: [[{ code: 0 }]] });
  });

  it("prints the findings and the verdict, and exits 1, when the run fails", async () => {
    const ran = await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo"],
      stagesOver: stagesOverGiving({ stages: FAILING_STAGES }),
    });
    expect(ran).toEqual({ writes: [[{ text: FAILING_REPORT }]], exits: [[{ code: 1 }]] });
  });

  it("prints a line for each package file the engine found missing or out of date, and fails, though the root projection is current", async () => {
    const stages = stagesGiving({
      engines: vi
        .fn<VersionTwoStages["engines"]>()
        .mockResolvedValue({ outcome: "ok", value: [SLICES_RUN] }),
    });
    const ran = await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo"],
      stagesOver: stagesOverGiving({ stages }),
    });
    expect(ran).toEqual({
      writes: [
        [
          {
            text: `projection-problems (2)
eslint missing packages/a/hone.eslint.mjs: that slice is not written; run node /install/src/hone.ts project --repo /repo and commit every file it writes
eslint out-of-date packages/b/hone.eslint.mjs: that slice differs from what hone project writes now; run node /install/src/hone.ts project --repo /repo and commit every file it writes
verdict: fail
`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("builds the stages over the repository, the install the command runs from and the base revision given", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo", "--base-revision", "origin/main"],
      stagesOver,
    });
    expect(stagesOver).toHaveBeenCalledWith(
      expect.objectContaining({
        locations: {
          repoRoot: "/repo",
          installRoot: "/install",
          moduleExtension: ".ts",
          baseRevision: "origin/main",
        },
      }),
    );
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({
      settings: vi
        .fn<VersionTwoStages["settings"]>()
        .mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }),
    });
    const ran = await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo"],
      stagesOver: stagesOverGiving({ stages }),
    });
    expect(ran).toEqual({
      writes: [
        [
          {
            text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints the upgrade-needed line naming the upgrade command for this repository", async () => {
    const upgrade: RunLoadFailure = { kind: "upgrade-needed", path: "disciplines.json" };
    const stages = stagesGiving({
      records: vi
        .fn<VersionTwoStages["records"]>()
        .mockReturnValue({ outcome: "failed", error: upgrade }),
    });
    const ran = await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo"],
      stagesOver: stagesOverGiving({ stages }),
    });
    expect(ran).toEqual({
      writes: [
        [
          {
            text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /install/src/hone.ts upgrade --repo /repo, which rewrites every version 1 file as version 2, and commit what it writes\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints the install-root-unresolvable line as it is, and exits 2, when the command was not started from a file", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({
      moduleUrl: "https://example.com/tool-command.js",
      arguments: ["--repo", "/repo"],
      stagesOver,
    });
    expect(ran).toEqual({ writes: [[{ text: INSTALL_ROOT_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });

  it("prints an arguments-invalid line, exits 2 and builds no stages when the arguments are not readable", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo"], stagesOver });
    expect(ran).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });

  it("refuses --report-output failures-only, which version 2 calls actionable, building no stages", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({
      moduleUrl: ENTRY_URL,
      arguments: ["--repo", "/repo", "--report-output", "failures-only"],
      stagesOver,
    });
    expect(ran).toEqual({
      writes: [
        [
          {
            text: 'load failure: arguments-invalid --report-output takes full, actionable, counts or verdict-only, not "failures-only"\n',
          },
        ],
      ],
      exits: [[{ code: 2 }]],
    });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});

const EMPTY_RUN_REPORT: RunReport = {
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

describe("versionTwoReportRequestOf", () => {
  it("hands the printed report the run's report, catalogue and output, the check's commands and the symptom page shown from the repository", () => {
    expect(
      versionTwoReportRequestOf({
        ports: {
          path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
          fileText: {
            exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
            read: vi.fn<FileTextPort["read"]>().mockReturnValue({
              outcome: "failed",
              error: { kind: "unreadable", path: "/repo/package.json", detail: "absent" },
            }),
            write: vi.fn<FileTextPort["write"]>(),
          },
        },
        produced: {
          located: { repoRoot: absoluteRootOf("/repo"), installRoot: absoluteRootOf("/install") },
          commands: {
            projectCommand: "node /install/src/hone.ts project --repo /repo",
            pruneCommand: "node /install/src/hone.ts prune-debt --repo /repo",
          },
          run: {
            report: EMPTY_RUN_REPORT,
            catalogue: REPORT_CATALOGUE,
            touched: { measured: "yes", paths: new Set() },
            output: "counts",
            runs: [],
          },
        },
      }),
    ).toEqual({
      report: EMPTY_RUN_REPORT,
      catalogue: REPORT_CATALOGUE,
      output: "counts",
      symptomPage: "../install/rules/typescript/symptoms.md",
      projectCommand: "node /install/src/hone.ts project --repo /repo",
      pruneCommand: "node /install/src/hone.ts prune-debt --repo /repo",
    });
  });
});
