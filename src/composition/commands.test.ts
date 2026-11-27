import { assert, describe, expect, it, vi } from "vitest";

import type { CommandRequest } from "../application/ports/command-request.ts";
import type { NamedEngineRun } from "../application/ports/engine/engine-run.ts";
import type {
  DirectoryEntry,
  DirectoryPort,
} from "../application/ports/file-system/directory-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
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
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../domain/language-layer/symptom-catalogue.ts";
import type {
  PlacedRecord,
  RecordsReading,
  SymptomReach,
} from "../domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import type { TouchedSet } from "../domain/repository/touched-set.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../domain/rule-set/rule-set-name-of.ts";
import type { CheckHit, CheckNativeException } from "../domain/runner/check-observations.ts";
import type { ChecksSliceProblem } from "../domain/runner/checks-run-report.ts";
import type { ForfeitureAssessment } from "../domain/settings/assessment.ts";
import { DEFAULT_CONVENTIONS } from "../domain/settings/conventions.ts";
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";
import { createRecordsFolder } from "../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "../infrastructure/hone-records-folder/writing/records-edit.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import {
  AUTHORISE,
  VERSION_TWO_PRUNE_DEBT,
  VERSION_TWO_RECORD_DEBT,
  type VersionTwoRecordPorts,
} from "./commands.ts";
import { commandOf } from "./composed-command.ts";
import type { StagesOver } from "./version-two-stages.ts";

const versionTwoRecordDebtCommandOf =
  (ports: Omit<VersionTwoRecordPorts, keyof CommandRequest>) => (command: CommandRequest) => {
    const recordDebtCommand = commandOf({
      tool: VERSION_TWO_RECORD_DEBT,
      ports: { ...command, ...ports },
    });
    return recordDebtCommand(command);
  };

const versionTwoPruneDebtCommandOf =
  (ports: Omit<VersionTwoRecordPorts, keyof CommandRequest>) => (command: CommandRequest) => {
    const pruneDebtCommand = commandOf({
      tool: VERSION_TWO_PRUNE_DEBT,
      ports: { ...command, ...ports },
    });
    return pruneDebtCommand(command);
  };

const versionTwoAuthoriseCommandOf =
  (ports: Omit<VersionTwoRecordPorts, keyof CommandRequest>) => (command: CommandRequest) => {
    const authoriseCommand = commandOf({ tool: AUTHORISE, ports: { ...command, ...ports } });
    return authoriseCommand(command);
  };

const recordsFolderPorts = (request: {
  readonly exists: "present" | "absent";
  readonly folders: readonly DirectoryEntry[];
  readonly files: readonly DirectoryEntry[];
  readonly text: string;
}): {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly fileRemoval: FileRemovalPort;
} => ({
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue(request.exists),
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
    write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
  },
  directory: {
    list: vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValueOnce({ outcome: "ok", value: request.folders })
      .mockReturnValueOnce({ outcome: "ok", value: request.files }),
    create: vi.fn<DirectoryPort["create"]>().mockReturnValue({ outcome: "ok", value: undefined }),
  },
  fileRemoval: {
    remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue({ outcome: "ok", value: undefined }),
  },
});

const nothingHeld = () =>
  recordsFolderPorts({ exists: "absent", folders: [], files: [], text: "" });

const debtHeld = (request: { readonly text: string }) =>
  recordsFolderPorts({
    exists: "present",
    folders: [{ name: "debt", kind: "directory" }],
    files: [{ name: "claimed-type.json", kind: "file" }],
    text: request.text,
  });

const authorisedLocationHeld = (request: { readonly text: string }) =>
  recordsFolderPorts({
    exists: "present",
    folders: [{ name: "authorised-locations", kind: "directory" }],
    files: [{ name: "claimed-type.json", kind: "file" }],
    text: request.text,
  });

const commandOver = (request: {
  readonly process: ProcessPort;
  readonly fileText: FileTextPort;
}): VersionOneCommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  modules: { load: vi.fn() },
  git: {
    trackedPaths: vi.fn(),
    changedSince: vi.fn(),
    contentInBase: vi.fn(),
    textInBase: vi.fn(),
    renamedSince: vi
      .fn<GitPort["renamedSince"]>()
      .mockReturnValue({ outcome: "ok", value: new Map() }),
  },
  exceptionRepositoryOf: vi.fn(),
  exceptionEntryParser: {
    parseExceptionEntries: vi.fn(),
    importedEntriesIn: vi.fn(),
    importSourcesOf: vi.fn(),
  },
  selectionRepositoryOf: vi.fn(),
  shownPathOfRepository: vi.fn(),
  moduleUrl: "file:///install/src/hone.ts",
});

const gitTreeStub = (): GitTreePort => ({ pathsAt: () => ({ outcome: "ok", value: [] }) });

const authoriseArgumentsFor = (request: {
  readonly repo: string;
  readonly answers: string;
  readonly rootCause: string;
}): readonly string[] => [
  "--repo",
  request.repo,
  "--answers",
  request.answers,
  "--file",
  "src/a.ts",
  "--case",
  "gives-a-value-its-type",
  "--owes",
  "declared-not-asserted",
  "--why",
  "Why does the audit refuse tracker ids in carve-out names?",
  "--because",
  "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
  "--evidence",
  "tools/audit/name-matcher.ts:14",
  "--why",
  "Why does the name matcher accept only lowercase slugs?",
  "--because",
  "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
  "--evidence",
  "tools/git/branch-name.ts:8",
  "--why",
  "Why was the matcher copied from the branch-name validator?",
  "--because",
  "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
  "--evidence",
  "PR #212, merged 2026-07-02",
  "--why",
  "Why did no shared slug type exist when the audit landed?",
  "--because",
  "The values package that now holds RepoPath was split out two months after the audit.",
  "--evidence",
  "packages/values/package.json:3",
  "--why",
  "Why was the values package split out after the audit?",
  "--because",
  "The split waited on the monorepo move, which left older tools on their own patterns.",
  "--evidence",
  "docs/decisions/0007-monorepo.md:21",
  "--root-cause",
  request.rootCause,
  "--root-evidence",
  "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  "--readback",
  "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  "--owner",
  "capture 01a0b421",
];

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

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
  symptom: DATE_USED_DIRECTLY,
  page: "date-used-directly/clock-sources.md",
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
  findingSpecifics: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  page: "branch-in-a-test/test-body.md",
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
  findingSpecifics: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
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
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ form: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE_A = repoPathOf("src/a.ts");

const settingsWith = (request: {
  readonly forfeiture: ForfeitureAssessment;
}): NamedSettingsReading => ({
  available: [],
  selection: {
    selected: [],
    notAdopted: [],
    notRun: [],
    excluded: [],
    eslintConfigRoots: [],
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: request.forfeiture } },
  eslintConfigLookup: { lookup: "detected" },
  eslintProjectionKind: "mjs",
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
});

const NO_RECORDS: RecordsReading = {
  records: [],
  refused: [],
  notes: [],
  base: { measured: "yes", placements: [] },
};

const HELD_DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: FILE_A,
    holding: { held: "stated" },
  },
};

const CAST: CheckHit = {
  check: "claimed-type#cast-expressions",
  file: FILE_A,
  anchor: { line: 4, column: 9 },
  snippet: "body as Event",
};

const runOf = (request: { readonly hits: readonly CheckHit[] }): NamedEngineRun => ({
  mechanism: ESLINT,
  hits: request.hits,
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  candidateFiles: [],
  comparedOutputs: [],
  inapplicable: [],
  slices: [],
  measured: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
});

const INLINE_DISABLE: CheckNativeException = {
  kind: "inline-disable",
  check: "claimed-type#cast-expressions",
  file: FILE_A,
  line: 3,
  text: "// eslint-disable-next-line hone/claimed-type#cast-expressions",
  reach: "one-check",
};

const IGNORE: CheckNativeException = {
  kind: "ignore",
  check: "claimed-type#cast-expressions",
  file: FILE_A,
};

const INLINE_RULE_CONFIG: CheckNativeException = {
  kind: "inline-rule-config",
  check: "claimed-type#cast-expressions",
  file: FILE_A,
  line: 4,
  text: '/* eslint hone/claimed-type#cast-expressions: "off" */',
};

const SUPPRESSION_ENTRY: CheckNativeException = {
  kind: "suppression-entry",
  check: "claimed-type#cast-expressions",
  file: FILE_A,
  location: repoPathOf("eslint-suppressions.json"),
};

const CONFIG_OVERRIDE: CheckNativeException = {
  kind: "config-override",
  check: "claimed-type#cast-expressions",
  file: FILE_A,
};

const COMMAND_LINE_OPTION: CheckNativeException = {
  kind: "command-line-option",
  check: "claimed-type#cast-expressions",
  location: repoPathOf("package.json"),
  script: "lint",
  option: "--no-inline-config",
  cause: { kind: "weakens-run" },
};

const runHoldingNatives = (request: {
  readonly nativeExceptions: readonly CheckNativeException[];
}): NamedEngineRun => ({
  ...runOf({ hits: [] }),
  nativeExceptions: request.nativeExceptions,
  coverableKinds: ["config-override", "inline-disable"],
});

const stagesHoldingNatives = (request: {
  readonly nativeExceptions: readonly CheckNativeException[];
}): VersionTwoStages =>
  stagesGiving({
    engines: vi
      .fn<VersionTwoStages["engines"]>()
      .mockResolvedValue({ outcome: "ok", value: [runHoldingNatives(request)] }),
  });

const settingsStageFor = (request: { readonly forfeiture: ForfeitureAssessment }) =>
  vi
    .fn<VersionTwoStages["settings"]>()
    .mockReturnValue({ outcome: "ok", value: settingsWith(request) });

const touchedStageGiving = (request: { readonly touched: TouchedSet }) =>
  vi.fn<VersionTwoStages["touched"]>().mockReturnValue(request.touched);

const FILE_A_CHANGED: TouchedSet = { measured: "yes", paths: new Set([FILE_A]) };

const LEFT_TO_ANOTHER_RUN: TouchedSet = { measured: "elsewhere" };

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi
    .fn<VersionTwoStages["catalogue"]>()
    .mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: settingsStageFor({ forfeiture: "this-run" }),
  records: vi
    .fn<VersionTwoStages["records"]>()
    .mockReturnValue({ outcome: "ok", value: NO_RECORDS }),
  tree: vi
    .fn<VersionTwoStages["tree"]>()
    .mockReturnValue({ outcome: "ok", value: { tracked: [FILE_A], declaredConfigRoots: [] } }),
  engines: vi
    .fn<VersionTwoStages["engines"]>()
    .mockResolvedValue({ outcome: "ok", value: [runOf({ hits: [CAST] })] }),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  renamed: vi
    .fn<VersionTwoStages["renamed"]>()
    .mockReturnValue({ measured: "yes", renamed: new Map() }),
  touched: vi
    .fn<VersionTwoStages["touched"]>()
    .mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

const ranWith = async (request: {
  readonly handler: typeof versionTwoRecordDebtCommandOf;
  readonly arguments: readonly string[];
  readonly stages: VersionTwoStages;
  readonly held: {
    readonly fileText: FileTextPort;
    readonly directory: DirectoryPort;
    readonly fileRemoval: FileRemovalPort;
  };
}) => {
  const { held } = request;
  const stagesOver = vi.fn<StagesOver>().mockReturnValue(request.stages);
  const process = {
    arguments: request.arguments,
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  };
  const command = request.handler({
    namedEngine: { load: vi.fn() },
    gitTree: gitTreeStub(),
    directory: held.directory,
    fileRemoval: held.fileRemoval,
    recordsSourceOf: createRecordsFolder,
    settingsSourcesOf: createSettingsSources,
    stagesOver,
    recordsReader,
    recordsEditor,
  });
  await command(commandOver({ process, fileText: held.fileText }));
  return {
    writes: process.writeOut.mock.calls,
    exits: process.exitWith.mock.calls,
    written: vi.mocked(held.fileText.write).mock.calls,
    removed: vi.mocked(held.fileRemoval.remove).mock.calls,
    stagesOver,
  };
};

const CONFIG_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const CONFIG_ABSENT_LINE =
  "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n";

const ARGUMENTS_INVALID_LINE =
  "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n";

const RECORD_ARGUMENTS = ["--repo", "/repo", "--base-revision", "origin/main"] as const;

const DEBT_FILE = "hone-records/debt/claimed-type.json";

const PROJECT_LINE =
  "run node /install/src/hone.ts project --repo /repo to put the recorded debt into effect\n";

const DEBT_DOCUMENT =
  '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type#cast-expressions",\n      "file": "src/a.ts"\n    }\n  ]\n}\n';

describe("versionTwoRecordDebtCommandOf", () => {
  it("builds the stages over the repository, the install and the base revision given, and measures the change whether or not debt is held", async () => {
    const stages = stagesGiving({});
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect(ran.stagesOver).toHaveBeenCalledWith(
      expect.objectContaining({
        locations: {
          repoRoot: "/repo",
          installRoot: "/install",
          moduleExtension: ".ts",
          baseRevision: "origin/main",
        },
      }),
    );
    expect(stages.touched).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { baseScope: "merge-base", measuring: "always" } }),
    );
  });

  it("writes the debt the run found and prints it recorded, exit 0", async () => {
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }]],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([
      [{ path: "/repo/hone-records/debt/claimed-type.json", text: DEBT_DOCUMENT }],
    ]);
  });

  it("repoints a record held at a path git moved, prints the repoint and the project command, and records nothing", async () => {
    const cart = repoPathOf("src/cart.ts");
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: stagesGiving({
        records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({
          outcome: "ok",
          value: {
            ...NO_RECORDS,
            records: [HELD_DEBT],
            base: { measured: "yes", placements: [HELD_DEBT] },
          },
        }),
        renamed: vi.fn<VersionTwoStages["renamed"]>().mockReturnValue({
          measured: "yes",
          renamed: new Map([[cart, { basePath: FILE_A, content: "unchanged" }]]),
        }),
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
          outcome: "ok",
          value: [runOf({ hits: [{ ...CAST, file: cart }] })],
        }),
      }),
      held: debtHeld({ text: DEBT_DOCUMENT }),
    });
    expect({ writes: ran.writes, exits: ran.exits, written: ran.written }).toEqual({
      writes: [
        [
          {
            text: `hone-records/debt/claimed-type.json records[0] repointed to src/cart.ts\n${PROJECT_LINE}`,
          },
        ],
      ],
      exits: [[{ code: 0 }]],
      written: [
        [
          {
            path: "/repo/hone-records/debt/claimed-type.json",
            text: '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type#cast-expressions",\n      "file": "src/cart.ts"\n    }\n  ]\n}\n',
          },
        ],
      ],
    });
  });

  it("refuses debt on a touched file, printing the touched line, when the repository's own setting is this-run", async () => {
    const touched = touchedStageGiving({ touched: FILE_A_CHANGED });
    const stages = stagesGiving({
      touched,
      settings: settingsStageFor({ forfeiture: "this-run" }),
    });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect(touched).toHaveBeenCalledWith({
      scope: { baseScope: "merge-base", measuring: "always" },
      records: NO_RECORDS,
      renamed: { measured: "yes", renamed: new Map() },
    });
    expect(ran.writes).toEqual([
      [
        {
          text: "claimed-type#cast-expressions touched src/a.ts: this change created or changed the file, so this run would forfeit debt on it; fix the finding there\n",
        },
      ],
    ]);
    expect(ran.written).toEqual([]);
  });

  it("writes debt on a touched file, printing no touched line, when the repository's own setting is elsewhere", async () => {
    const touched = touchedStageGiving({ touched: LEFT_TO_ANOTHER_RUN });
    const stages = stagesGiving({
      touched,
      settings: settingsStageFor({ forfeiture: "elsewhere" }),
    });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect(touched).toHaveBeenCalledWith({
      scope: { baseScope: "elsewhere" },
      records: NO_RECORDS,
      renamed: { measured: "yes", renamed: new Map() },
    });
    expect(ran.writes).toEqual([
      [{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }],
    ]);
    expect(ran.written).toEqual([
      [{ path: "/repo/hone-records/debt/claimed-type.json", text: DEBT_DOCUMENT }],
    ]);
  });

  it("leaves a file the person records as an authorised location, printing it left", async () => {
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: [...RECORD_ARGUMENTS, "--leave", "src/a.ts"],
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect(ran.writes).toEqual([
      [
        {
          text: "claimed-type#cast-expressions left src/a.ts: under --leave src/a.ts; record it as an authorised location with a why chain, or fix it\n",
        },
      ],
    ]);
    expect(ran.written).toEqual([]);
  });

  it("writes nothing the second time, printing the held debt as already recorded", async () => {
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: stagesGiving({}),
      held: debtHeld({ text: DEBT_DOCUMENT }),
    });
    expect(ran.writes).toEqual([
      [
        {
          text: `claimed-type#cast-expressions already-recorded src/a.ts: ${DEBT_FILE} already holds debt on this symptom and file; the check says why it does not answer\n`,
        },
      ],
    ]);
    expect(ran.written).toEqual([]);
  });

  it("writes the debt an inline disable needs on its check and file when no finding is on that site, printing it recorded", async () => {
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: stagesHoldingNatives({ nativeExceptions: [INLINE_DISABLE] }),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }]],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([
      [{ path: "/repo/hone-records/debt/claimed-type.json", text: DEBT_DOCUMENT }],
    ]);
  });

  it("prints one line for a finding and an inline disable on the same check and file", async () => {
    const stages = stagesGiving({
      engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
        outcome: "ok",
        value: [{ ...runHoldingNatives({ nativeExceptions: [INLINE_DISABLE] }), hits: [CAST] }],
      }),
    });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect(ran.writes).toEqual([
      [{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }],
    ]);
  });

  it("writes nothing and names what to do instead for each exception no debt can hold", async () => {
    const stages = stagesHoldingNatives({
      nativeExceptions: [IGNORE, INLINE_RULE_CONFIG, SUPPRESSION_ENTRY, COMMAND_LINE_OPTION],
    });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [
        [
          {
            text: `claimed-type#cast-expressions unrecordable package.json: a lint-script option weakens the script's whole run, so no record can cover it; remove it from the script
claimed-type#cast-expressions unrecordable src/a.ts: an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree
claimed-type#cast-expressions unrecordable src/a.ts: a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment
claimed-type#cast-expressions unrecordable src/a.ts: an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file
`,
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([]);
  });

  it("never writes debt for a config override, naming the override as unrecordable and printing no project line", async () => {
    const stages = stagesHoldingNatives({ nativeExceptions: [CONFIG_OVERRIDE] });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [
        [
          {
            text: "claimed-type#cast-expressions unrecordable src/a.ts: an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([]);
  });

  it("gives a script option the advice that matches why Hone could not judge it", async () => {
    const wrapped: CheckNativeException = {
      ...COMMAND_LINE_OPTION,
      cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
    };
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: stagesHoldingNatives({ nativeExceptions: [wrapped] }),
      held: nothingHeld(),
    });
    expect(ran.writes).toEqual([
      [
        {
          text: 'claimed-type#cast-expressions unrecordable package.json: "env" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint\n',
        },
      ],
    ]);
  });

  it("does not tell a touched file's inline disable to fix a finding that is not there", async () => {
    const stages = stagesHoldingNatives({ nativeExceptions: [INLINE_DISABLE] });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: { ...stages, touched: touchedStageGiving({ touched: FILE_A_CHANGED }) },
      held: nothingHeld(),
    });
    expect(ran.writes).toEqual([
      [
        {
          text: "claimed-type#cast-expressions touched src/a.ts: this change created or changed the file, so this run would forfeit debt on it; fix what the comment hides, then remove the comment\n",
        },
      ],
    ]);
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({
      settings: vi
        .fn<VersionTwoStages["settings"]>()
        .mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }),
    });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: CONFIG_ABSENT_LINE }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("refuses naming the project command, and writes no debt, when the projection is out of date", async () => {
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: RECORD_ARGUMENTS,
      stages: stagesGiving({
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
          outcome: "ok",
          value: [
            {
              ...runOf({ hits: [CAST] }),
              projection: "out-of-date",
              projectionFile: repoPathOf("hone.eslint.mjs"),
            },
          ],
        }),
      }),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits, written: ran.written }).toEqual({
      writes: [
        [
          {
            text: "load failure: projection-stale eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run node /install/src/hone.ts project --repo /repo and commit every file it writes\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
      written: [],
    });
  });

  it("prints an arguments-invalid line and builds no stages when the arguments are not readable", async () => {
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: ["--repo"],
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: ARGUMENTS_INVALID_LINE }]],
      exits: [[{ code: 2 }]],
    });
    expect(ran.stagesOver).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtCommandOf", () => {
  const HELD_DEBT_STAGES = stagesGiving({
    records: vi
      .fn<VersionTwoStages["records"]>()
      .mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
    engines: vi
      .fn<VersionTwoStages["engines"]>()
      .mockResolvedValue({ outcome: "ok", value: [runOf({ hits: [] })] }),
  });

  it("removes the debt the run shows stale, printing each debt removed, and deletes the emptied records file", async () => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: HELD_DEBT_STAGES,
      held: debtHeld({
        text: '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type",\n      "file": "src/a.ts"\n    }\n  ]\n}\n',
      }),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: "claimed-type removed src/a.ts: stale\n" }]],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([]);
  });

  const settingsSelectingCast = (): NamedSettingsReading => {
    const settings = settingsWith({ forfeiture: "this-run" });
    return {
      ...settings,
      selection: {
        ...settings.selection,
        selected: [
          {
            address: { ruleSet: TOOL_RULE_SET, check: "claimed-type#cast-expressions" },
            check: CAST_CHECK,
            exceptions: "allowed",
            binding: {
              address: "claimed-type#cast-expressions",
              ruleSet: TOOL_RULE_SET,
              engine: ESLINT,
              pieceRoot: "/install/cast",
              settings: {},
              checkSettings: {},
              anchor: { kind: "file" },
              edition: editionOf("1"),
            },
            editions: {
              declared: [editionOf("1")],
              default: editionOf("1"),
              latest: editionOf("1"),
            },
          },
        ],
      },
    };
  };

  const prunedWhileEngineRan = async (request: { readonly run: NamedEngineRun }) => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: stagesGiving({
        settings: vi
          .fn<VersionTwoStages["settings"]>()
          .mockReturnValue({ outcome: "ok", value: settingsSelectingCast() }),
        records: vi
          .fn<VersionTwoStages["records"]>()
          .mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
        engines: vi
          .fn<VersionTwoStages["engines"]>()
          .mockResolvedValue({ outcome: "ok", value: [request.run] }),
      }),
      held: debtHeld({ text: DEBT_DOCUMENT }),
    });
    return { writes: ran.writes, exits: ran.exits, removed: ran.removed };
  };

  it("keeps the debt, printing nothing, when the engine measuring its check was not in effect, since nothing was measured to show it stale", async () => {
    expect(
      await prunedWhileEngineRan({
        run: {
          ...runOf({ hits: [] }),
          projection: "not-included",
          projectionFile: repoPathOf("hone.eslint.mjs"),
        },
      }),
    ).toEqual({
      writes: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
      removed: [],
    });
  });

  it("refuses, keeping the debt, when a package slice is missing, naming the project command that writes it", async () => {
    const missingSlice: ChecksSliceProblem = {
      file: repoPathOf("packages/a/hone.eslint.mjs"),
      state: "missing",
    };
    expect(
      await prunedWhileEngineRan({ run: { ...runOf({ hits: [] }), slices: [missingSlice] } }),
    ).toEqual({
      writes: [
        [
          {
            text: "load failure: projection-stale eslint missing packages/a/hone.eslint.mjs: that slice is not written; run node /install/src/hone.ts project --repo /repo and commit every file it writes\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
      removed: [],
    });
  });

  it("removes the debt on a file no longer in the tree, with no base revision, since nothing is left to measure", async () => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: stagesGiving({
        settings: vi
          .fn<VersionTwoStages["settings"]>()
          .mockReturnValue({ outcome: "ok", value: settingsSelectingCast() }),
        records: vi
          .fn<VersionTwoStages["records"]>()
          .mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
        tree: vi
          .fn<VersionTwoStages["tree"]>()
          .mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
          outcome: "ok",
          value: [
            {
              ...runOf({ hits: [] }),
              projection: "not-included",
              projectionFile: repoPathOf("hone.eslint.mjs"),
            },
          ],
        }),
        renamed: vi
          .fn<VersionTwoStages["renamed"]>()
          .mockReturnValue({ measured: "yes", renamed: new Map() }),
        touched: vi
          .fn<VersionTwoStages["touched"]>()
          .mockReturnValue({ measured: "no", base: { state: "not-given" } }),
      }),
      held: debtHeld({ text: DEBT_DOCUMENT }),
    });
    expect({ writes: ran.writes, exits: ran.exits, removed: ran.removed }).toEqual({
      writes: [
        [
          {
            text: "claimed-type removed src/a.ts: stale, its file is no longer in the repository\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
      removed: [[{ path: "/repo/hone-records/debt/claimed-type.json" }]],
    });
  });

  it("removes the debt on a file the settings exclude, saying its file is excluded, as it did before engines reported what they measured", async () => {
    const settings = settingsSelectingCast();
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: stagesGiving({
        settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({
          outcome: "ok",
          value: { ...settings, selection: { ...settings.selection, excluded: [FILE_A] } },
        }),
        records: vi
          .fn<VersionTwoStages["records"]>()
          .mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
        tree: vi
          .fn<VersionTwoStages["tree"]>()
          .mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({
          outcome: "ok",
          value: [
            {
              ...runOf({ hits: [] }),
              projection: "not-included",
              projectionFile: repoPathOf("hone.eslint.mjs"),
            },
          ],
        }),
      }),
      held: debtHeld({ text: DEBT_DOCUMENT }),
    });
    expect({ writes: ran.writes, exits: ran.exits, removed: ran.removed }).toEqual({
      writes: [
        [
          {
            text: "claimed-type removed src/a.ts: stale, its file is excluded by the settings\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
      removed: [[{ path: "/repo/hone-records/debt/claimed-type.json" }]],
    });
  });

  it("removes the debt once the engine measured its check at its file and found nothing", async () => {
    const measured: NamedEngineRun = {
      ...runOf({ hits: [] }),
      measured: [{ check: "claimed-type#cast-expressions", file: FILE_A }],
    };
    expect(await prunedWhileEngineRan({ run: measured })).toEqual({
      writes: [[{ text: "claimed-type removed src/a.ts: stale\n" }]],
      exits: [[{ code: 0 }]],
      removed: [[{ path: "/repo/hone-records/debt/claimed-type.json" }]],
    });
  });

  it("measures the change only when debt is held, as the check does, and prints nothing when none is shown", async () => {
    const stages = stagesGiving({});
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages,
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
    });
    expect(stages.touched).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { baseScope: "merge-base", measuring: "when-debt-held" } }),
    );
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({
      records: vi
        .fn<VersionTwoStages["records"]>()
        .mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }),
    });
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages,
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: CONFIG_ABSENT_LINE }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints an arguments-invalid line and builds no stages when the arguments are not readable", async () => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo"],
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: ARGUMENTS_INVALID_LINE }]],
      exits: [[{ code: 2 }]],
    });
    expect(ran.stagesOver).not.toHaveBeenCalled();
  });
});

const ACCEPTED_ROOT_CAUSE =
  "Older tools still carry patterns written before the monorepo move gave them shared value types.";

const ACCEPTED_ARGUMENTS = authoriseArgumentsFor({
  repo: "/repo",
  answers: "claimed-type#cast-expressions",
  rootCause: ACCEPTED_ROOT_CAUSE,
});

const REFUSED_ARGUMENTS = authoriseArgumentsFor({
  repo: "/repo",
  answers: "claimed-type#cast-expressions",
  rootCause: "no",
});

const AUTHORISED_FILE = "hone-records/authorised-locations/claimed-type.json";

describe("versionTwoAuthoriseCommandOf", () => {
  it("reads the catalogue and the settings, never running the engines", async () => {
    const stages = stagesGiving({});
    await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect(stages.catalogue).toHaveBeenCalled();
    expect(stages.settings).toHaveBeenCalled();
    expect(stages.engines).not.toHaveBeenCalled();
  });

  it("writes a team's location under the team's records folder and prints its address after the rule set", async () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamCast: Symptom = { ...CLAIMED_TYPE, ruleSet: acme, name: "team-cast" };
    const ran = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: authoriseArgumentsFor({
        repo: "/repo",
        answers: "acme/team-cast#casts",
        rootCause: ACCEPTED_ROOT_CAUSE,
      }),
      stages: stagesGiving({
        settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({
          outcome: "ok",
          value: {
            ...settingsWith({ forfeiture: "this-run" }),
            externalCatalogues: [
              {
                ruleSet: acme,
                catalogue: { ...REPORT_CATALOGUE, symptoms: [teamCast], checks: [] },
              },
            ],
          },
        }),
      }),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: "acme/team-cast#casts authorised src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([
      [
        {
          path: "/repo/hone-records/acme/authorised-locations/team-cast.json",
          text: expect.any(String),
        },
      ],
    ]);
  });

  it("writes the location for the symptom and file given, and prints it authorised, exit 0", async () => {
    const ran = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: "claimed-type#cast-expressions authorised src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
    });
    expect(ran.written).toEqual([
      [
        {
          path: "/repo/hone-records/authorised-locations/claimed-type.json",
          text: expect.stringContaining('"file": "src/a.ts"'),
        },
      ],
    ]);
  });

  it("prints the location already authorised, writing nothing, when the records hold it", async () => {
    const first = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    const firstWrite = first.written[0];
    assert.isDefined(firstWrite);
    const second = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages: stagesGiving({}),
      held: authorisedLocationHeld({ text: firstWrite[0].text }),
    });
    expect(second.writes).toEqual([
      [
        {
          text: `claimed-type#cast-expressions already-authorised src/a.ts: ${AUTHORISED_FILE} already holds this record\n`,
        },
      ],
    ]);
    expect(second.written).toEqual([]);
  });

  it("prints each refusal and exits 0, writing nothing, when the form refuses the chain", async () => {
    const ran = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: REFUSED_ARGUMENTS,
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect(ran.exits).toEqual([[{ code: 0 }]]);
    expect(ran.writes).toEqual([
      [{ text: expect.stringMatching(/^claimed-type#cast-expressions refused src\/a\.ts: /) }],
    ]);
    expect(ran.written).toEqual([]);
  });

  it("prints the load failure line and exits 2 when the catalogue cannot be read", async () => {
    const stages = stagesGiving({
      catalogue: vi
        .fn<VersionTwoStages["catalogue"]>()
        .mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }),
    });
    const ran = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages,
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: CONFIG_ABSENT_LINE }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints an arguments-invalid line and builds no stages when an option is missing a value", async () => {
    const ran = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ["--repo"],
      stages: stagesGiving({}),
      held: nothingHeld(),
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [[{ text: ARGUMENTS_INVALID_LINE }]],
      exits: [[{ code: 2 }]],
    });
    expect(ran.stagesOver).not.toHaveBeenCalled();
  });
});
