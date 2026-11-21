import { assert, describe, expect, it, vi } from "vitest";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import type { Case, Check, Engine, Pointed, Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { GitTreePort } from "../infrastructure/git/git-port.ts";
import { mechanismIdSchema } from "../infrastructure/hone-config-file/identifiers.ts";
import type { DirectoryEntry, DirectoryPort, FileRemovalPort } from "../infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../infrastructure/node/process/process-port.ts";
import type { ChecksSliceProblem } from "../domain/runner/checks-run-report.ts";
import type { Hit, NativeException } from "../domain/runner/runner-result-types.ts";
import type { PlacedRecord, RecordsReading, SymptomReach } from "../infrastructure/hone-records-folder/hone-record.ts";
import { createRecordsFolder } from "../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../domain/settings/conventions.ts";
import type { SettingsReading } from "../application/run/settings/read-settings.ts";
import type { TouchedSet } from "../domain/repository/touched-set.ts";
import type { ForfeitureAssessment } from "../domain/settings/assessment.ts";
import { repoPathSchema } from "../infrastructure/hone-records-folder/repo-path.ts";
import type { EngineRun } from "../infrastructure/engines/protocol/engine-run/engine-run.ts";
import type { StagesOver } from "../version-two-repository.ts";
import { versionTwoAuthoriseCommandOf, versionTwoPruneDebtCommandOf, versionTwoRecordDebtCommandOf } from "./version-two-record-commands.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";

const REPO_FOLDER = "/repo";

const SEPARATOR = "/";

type MemoryRepository = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly removal: FileRemovalPort;
  readonly textOf: (request: { readonly file: string }) => string | undefined;
  readonly filesHeld: () => readonly string[];
};

const absoluteOf = (request: { readonly file: string }): string => `${REPO_FOLDER}${SEPARATOR}${request.file}`;

const memoryRepositoryOf = (request: { readonly files: Readonly<Record<string, string>> }): MemoryRepository => {
  const held = new Map(Object.entries(request.files).map(([file, text]) => [absoluteOf({ file }), text] as const));
  const keysUnder = (folder: string): readonly string[] => [...held.keys()].filter((key) => key.startsWith(`${folder}${SEPARATOR}`));
  const entriesIn = (folder: string): readonly DirectoryEntry[] => {
    const names = keysUnder(folder).map((key) => key.slice(folder.length + 1));
    return [...new Set(names.map((name) => name.split(SEPARATOR)[0] ?? name))].map((name) => ({
      name,
      kind: names.some((deeper) => deeper.startsWith(`${name}${SEPARATOR}`)) ? "directory" : "file",
    }));
  };
  return {
    fileText: {
      exists: ({ path }) => (held.has(path) || keysUnder(path).length > 0 ? "present" : "absent"),
      read: ({ path }) => {
        const text = held.get(path);
        return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } } : { outcome: "ok", value: text };
      },
      write: ({ path, text }) => {
        held.set(path, text);
        return { outcome: "ok", value: undefined };
      },
    },
    directory: {
      list: ({ path }) => ({ outcome: "ok", value: entriesIn(path) }),
      create: () => ({ outcome: "ok", value: undefined }),
    },
    removal: {
      remove: ({ path }) => {
        held.delete(path);
        return { outcome: "ok", value: undefined };
      },
    },
    textOf: ({ file }) => held.get(absoluteOf({ file })),
    filesHeld: () => [...held.keys()].map((key) => key.slice(REPO_FOLDER.length + 1)).toSorted(),
  };
};

type Writes = Parameters<ProcessPort["writeOut"]>[];

type Exits = Parameters<ProcessPort["exitWith"]>[];

const recordedProcessWith = (request: { readonly arguments: readonly string[] }) => {
  const writes: Writes = [];
  const exits: Exits = [];
  const port: ProcessPort = {
    arguments: request.arguments,
    writeOut: (written) => writes.push([written]),
    writeError: () => undefined,
    exitWith: (exit) => exits.push([exit]),
  };
  return { port, writes, exits };
};

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

const commandOver = (request: { readonly process: ProcessPort; readonly fileText: FileTextPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  modules: { load: notUsed },
  git: { trackedPaths: notUsed, changedSince: notUsed, contentInBase: notUsed, textInBase: notUsed, renamedSince: notUsed },
  exceptionRepositoryOf: notUsed,
  moduleUrl: "file:///install/src/hone.ts",
});

const gitTreeStub = (): GitTreePort => ({ pathsAt: () => ({ outcome: "ok", value: [] }) });

const authoriseArgumentsFor = (request: { readonly repo: string; readonly rootCause: string }): readonly string[] => [
  "--repo",
  request.repo,
  "--answers",
  "claimed-type",
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

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

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

const OWED_DECLARED_NOT_ASSERTED: Pointed = { kind: "rule", rule: DECLARED_NOT_ASSERTED };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [OWED_DECLARED_NOT_ASSERTED],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted", reason: { text: "it narrows the type", standing: "accepted" } };

const ITEACH_OVER_TYPED_ROWS: Recipe = { name: "iteach-over-typed-rows", title: "it.each over typed rows", standing: "accepted", reason: { text: "each row is a case", standing: "accepted" } };

const BOUNDARY_RECORD_KIND: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

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
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" }],
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
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
};

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const TEST_BODY_LOGIC = clauseAddressSchema.parse("CD-27#test-body-logic");

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const CLOCK_CHECK: Check = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, engines: [WALKER], forms: [] };

const TEST_BODY_CHECK: Check = { name: "test-body", symptom: BRANCH_IN_A_TEST, clause: TEST_BODY_LOGIC, engines: [WALKER], forms: ["branching-with-if"] };

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
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

const FILE_A = repoPathSchema.parse("src/a.ts");

const settingsWith = (request: { readonly forfeiture: ForfeitureAssessment }): SettingsReading => ({
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: request.forfeiture } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
});

const NO_RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const HELD_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: FILE_A, holding: { held: "stated" } },
};

const CAST: Hit = { clause: CAST_EXPRESSIONS, file: FILE_A, anchor: { line: 4, column: 9 }, snippet: "body as Event", check: "claimed-type#cast-expressions" };

const runOf = (request: { readonly hits: readonly Hit[] }): EngineRun => ({
  mechanism: ESLINT,
  hits: request.hits,
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
});

const INLINE_DISABLE: NativeException = {
  kind: "inline-disable",
  clause: CAST_EXPRESSIONS,
  file: FILE_A,
  line: 3,
  text: "// eslint-disable-next-line hone/claimed-type#cast-expressions",
  reach: "one-clause",
};

const IGNORE: NativeException = { kind: "ignore", clause: CAST_EXPRESSIONS, file: FILE_A };

const INLINE_RULE_CONFIG: NativeException = {
  kind: "inline-rule-config",
  clause: CAST_EXPRESSIONS,
  file: FILE_A,
  line: 4,
  text: '/* eslint hone/claimed-type#cast-expressions: "off" */',
};

const SUPPRESSION_ENTRY: NativeException = { kind: "suppression-entry", clause: CAST_EXPRESSIONS, file: FILE_A, location: repoPathSchema.parse("eslint-suppressions.json") };

const CONFIG_OVERRIDE: NativeException = { kind: "config-override", clause: CAST_EXPRESSIONS, file: FILE_A };

const COMMAND_LINE_OPTION: NativeException = {
  kind: "command-line-option",
  clause: CAST_EXPRESSIONS,
  location: repoPathSchema.parse("package.json"),
  script: "lint",
  option: "--no-inline-config",
  cause: { kind: "weakens-run" },
};

const runHoldingNatives = (request: { readonly nativeExceptions: readonly NativeException[] }): EngineRun => ({
  ...runOf({ hits: [] }),
  nativeExceptions: request.nativeExceptions,
  coverableKinds: ["config-override", "inline-disable"],
});

const stagesHoldingNatives = (request: { readonly nativeExceptions: readonly NativeException[] }): VersionTwoStages =>
  stagesGiving({ engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [runHoldingNatives(request)] }) });

const settingsStageFor = (request: { readonly forfeiture: ForfeitureAssessment }) =>
  vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: settingsWith(request) });

const touchedStageGiving = (request: { readonly touched: TouchedSet }) => vi.fn<VersionTwoStages["touched"]>().mockReturnValue(request.touched);

const FILE_A_CHANGED: TouchedSet = { measured: "yes", paths: new Set([FILE_A]) };

const LEFT_TO_ANOTHER_RUN: TouchedSet = { measured: "elsewhere" };

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: settingsStageFor({ forfeiture: "this-run" }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: NO_RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [FILE_A], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [runOf({ hits: [CAST] })] }),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

type Handler = typeof versionTwoRecordDebtCommandOf;

const ranWith = async (request: {
  readonly handler: Handler;
  readonly arguments: readonly string[];
  readonly stages: VersionTwoStages;
  readonly files: Readonly<Record<string, string>>;
}) => {
  const repository = memoryRepositoryOf({ files: request.files });
  const stagesOver = vi.fn<StagesOver>().mockReturnValue(request.stages);
  const recorded = recordedProcessWith({ arguments: request.arguments });
  await request.handler({
    gitTree: gitTreeStub(),
    directory: repository.directory,
    removal: repository.removal,
    recordsSourceOf: createRecordsFolder,
    stagesOver,
  })(
    commandOver({ process: recorded.port, fileText: repository.fileText }),
  );
  return { writes: recorded.writes, exits: recorded.exits, repository, stagesOver };
};

const CONFIG_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const CONFIG_ABSENT_LINE = "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n";

const ARGUMENTS_INVALID_LINE = "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n";

const RECORD_ARGUMENTS = ["--repo", "/repo", "--base-revision", "origin/main"] as const;

const DEBT_FILE = "hone-records/debt/claimed-type.json";

const PROJECT_LINE = "run node /install/src/hone.ts project --repo /repo to put the recorded debt into effect\n";

const DEBT_DOCUMENT = '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type#cast-expressions",\n      "file": "src/a.ts"\n    }\n  ]\n}\n';

describe("versionTwoRecordDebtCommandOf", () => {
  it("builds the stages over the repository, the install and the base revision given, and measures the change whether or not debt is held", async () => {
    const stages = stagesGiving({});
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect(ran.stagesOver).toHaveBeenCalledWith(
      expect.objectContaining({ locations: { repoRoot: "/repo", installRoot: "/install", moduleExtension: ".ts", baseRevision: "origin/main" } }),
    );
    expect(stages.touched).toHaveBeenCalledWith(expect.objectContaining({ measuring: "always" }));
  });

  it("writes the debt the run found and prints it recorded, exit 0", async () => {
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages: stagesGiving({}), files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }]], exits: [[{ code: 0 }]] });
    expect(ran.repository.textOf({ file: DEBT_FILE })).toBe(DEBT_DOCUMENT);
  });

  it("refuses debt on a touched file, printing the touched line, when the repository's own setting is this-run", async () => {
    const touched = touchedStageGiving({ touched: FILE_A_CHANGED });
    const stages = stagesGiving({ touched, settings: settingsStageFor({ forfeiture: "this-run" }) });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect(touched).toHaveBeenCalledWith({ assessment: { forfeiture: "this-run" }, measuring: "always", records: NO_RECORDS });
    expect(ran.writes).toEqual([
      [{ text: "claimed-type#cast-expressions touched src/a.ts: this change created or changed the file, so this run would forfeit debt on it; fix the finding there\n" }],
    ]);
    expect(ran.repository.filesHeld()).toEqual([]);
  });

  it("writes debt on a touched file, printing no touched line, when the repository's own setting is elsewhere", async () => {
    const touched = touchedStageGiving({ touched: LEFT_TO_ANOTHER_RUN });
    const stages = stagesGiving({ touched, settings: settingsStageFor({ forfeiture: "elsewhere" }) });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect(touched).toHaveBeenCalledWith({ assessment: { forfeiture: "elsewhere" }, measuring: "always", records: NO_RECORDS });
    expect(ran.writes).toEqual([[{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }]]);
    expect(ran.repository.textOf({ file: DEBT_FILE })).toBe(DEBT_DOCUMENT);
  });

  it("leaves a file the person records as an authorised location, printing it left", async () => {
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: [...RECORD_ARGUMENTS, "--leave", "src/a.ts"], stages: stagesGiving({}), files: {} });
    expect(ran.writes).toEqual([
      [{ text: "claimed-type#cast-expressions left src/a.ts: under --leave src/a.ts; record it as an authorised location with its own reason, or fix it\n" }],
    ]);
    expect(ran.repository.filesHeld()).toEqual([]);
  });

  it("writes nothing the second time, printing the held debt as already recorded", async () => {
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages: stagesGiving({}), files: { [DEBT_FILE]: DEBT_DOCUMENT } });
    expect(ran.writes).toEqual([
      [{ text: `claimed-type#cast-expressions already-recorded src/a.ts: ${DEBT_FILE} already holds debt on this symptom and file; the check says why it does not answer\n` }],
    ]);
    expect(ran.repository.textOf({ file: DEBT_FILE })).toBe(DEBT_DOCUMENT);
  });

  it("writes the debt an inline disable needs on its check and file when no finding is on that site, printing it recorded", async () => {
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages: stagesHoldingNatives({ nativeExceptions: [INLINE_DISABLE] }), files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }]], exits: [[{ code: 0 }]] });
    expect(ran.repository.textOf({ file: DEBT_FILE })).toBe(DEBT_DOCUMENT);
  });

  it("prints one line for a finding and an inline disable on the same check and file", async () => {
    const stages = stagesGiving({
      engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [{ ...runHoldingNatives({ nativeExceptions: [INLINE_DISABLE] }), hits: [CAST] }] }),
    });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect(ran.writes).toEqual([[{ text: `claimed-type#cast-expressions recorded src/a.ts\n${PROJECT_LINE}` }]]);
  });

  it("writes nothing and names what to do instead for each exception no debt can hold", async () => {
    const stages = stagesHoldingNatives({ nativeExceptions: [IGNORE, INLINE_RULE_CONFIG, SUPPRESSION_ENTRY, COMMAND_LINE_OPTION] });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [
        [
          {
            text: `CD-2#cast-expressions unrecordable package.json: a lint-script option weakens the script's whole run, so no record can cover it; remove it from the script
CD-2#cast-expressions unrecordable src/a.ts: an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree
CD-2#cast-expressions unrecordable src/a.ts: a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment
CD-2#cast-expressions unrecordable src/a.ts: an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file
`,
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
    expect(ran.repository.filesHeld()).toEqual([]);
  });

  it("never writes debt for a config override, naming the override as unrecordable and printing no project line", async () => {
    const stages = stagesHoldingNatives({ nativeExceptions: [CONFIG_OVERRIDE] });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({
      writes: [
        [
          {
            text: "CD-2#cast-expressions unrecordable src/a.ts: an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
    expect(ran.repository.filesHeld()).toEqual([]);
  });

  it("gives a script option the advice that matches why Hone could not judge it", async () => {
    const wrapped: NativeException = { ...COMMAND_LINE_OPTION, cause: { kind: "wrapped", command: "eslint", wrapper: "env" } };
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages: stagesHoldingNatives({ nativeExceptions: [wrapped] }), files: {} });
    expect(ran.writes).toEqual([
      [
        {
          text: 'CD-2#cast-expressions unrecordable package.json: "env" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint\n',
        },
      ],
    ]);
  });

  it("does not tell a touched file's inline disable to fix a finding that is not there", async () => {
    const stages = stagesHoldingNatives({ nativeExceptions: [INLINE_DISABLE] });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages: { ...stages, touched: touchedStageGiving({ touched: FILE_A_CHANGED }) }, files: {} });
    expect(ran.writes).toEqual([
      [{ text: "claimed-type#cast-expressions touched src/a.ts: this change created or changed the file, so this run would forfeit debt on it; fix what the comment hides, then remove the comment\n" }],
    ]);
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({ settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }) });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: RECORD_ARGUMENTS, stages, files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: CONFIG_ABSENT_LINE }]], exits: [[{ code: 2 }]] });
  });

  it("prints an arguments-invalid line and builds no stages when the arguments are not readable", async () => {
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: ["--repo"], stages: stagesGiving({}), files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(ran.stagesOver).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtCommandOf", () => {
  const HELD_DEBT_STAGES = stagesGiving({
    records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
    engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [runOf({ hits: [] })] }),
  });

  it("removes the debt the run shows stale, printing each debt removed, and deletes the emptied records file", async () => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: HELD_DEBT_STAGES,
      files: { "hone-records/debt/claimed-type.json": '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type",\n      "file": "src/a.ts"\n    }\n  ]\n}\n' },
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: "claimed-type removed src/a.ts: stale\n" }]], exits: [[{ code: 0 }]] });
    expect(ran.repository.filesHeld()).toEqual([]);
  });

  const settingsSelectingCast = (): SettingsReading => {
    const settings = settingsWith({ forfeiture: "this-run" });
    return {
      ...settings,
      selection: {
        ...settings.selection,
        selection: { ...settings.selection.selection, selected: [{ address: CAST_EXPRESSIONS, mechanism: ESLINT, exceptions: "allowed" }] },
      },
    };
  };

  const prunedWhileEngineRan = async (request: { readonly run: EngineRun }) => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: stagesGiving({
        settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: settingsSelectingCast() }),
        records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [request.run] }),
      }),
      files: { [DEBT_FILE]: DEBT_DOCUMENT },
    });
    return { writes: ran.writes, exits: ran.exits, filesHeld: ran.repository.filesHeld() };
  };

  it("keeps the debt, printing nothing, when the engine measuring its check was not in effect, since nothing was measured to show it stale", async () => {
    expect(await prunedWhileEngineRan({ run: { ...runOf({ hits: [] }), projection: "not-included" } })).toEqual({
      writes: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
      filesHeld: [DEBT_FILE],
    });
  });

  it("keeps the debt when a package slice is missing, so the engine linted nothing under a current root projection", async () => {
    const missingSlice: ChecksSliceProblem = { slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "missing" };
    expect(await prunedWhileEngineRan({ run: { ...runOf({ hits: [] }), slices: [missingSlice] } })).toEqual({
      writes: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
      filesHeld: [DEBT_FILE],
    });
  });

  it("removes the debt on a file no longer in the tree, with no base revision, since nothing is left to measure", async () => {
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: stagesGiving({
        settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: settingsSelectingCast() }),
        records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
        tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [{ ...runOf({ hits: [] }), projection: "not-included" }] }),
        touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "no", base: { state: "not-given" } }),
      }),
      files: { [DEBT_FILE]: DEBT_DOCUMENT },
    });
    expect({ writes: ran.writes, exits: ran.exits, filesHeld: ran.repository.filesHeld() }).toEqual({
      writes: [[{ text: "claimed-type removed src/a.ts: stale, its file is no longer in the repository\n" }]],
      exits: [[{ code: 0 }]],
      filesHeld: [],
    });
  });

  it("removes the debt on a file the settings exclude, saying its file is excluded, as it did before engines reported what they measured", async () => {
    const settings = settingsSelectingCast();
    const ran = await ranWith({
      handler: versionTwoPruneDebtCommandOf,
      arguments: ["--repo", "/repo"],
      stages: stagesGiving({
        settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: { ...settings, selection: { ...settings.selection, excluded: [FILE_A] } } }),
        records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: { ...NO_RECORDS, records: [HELD_DEBT] } }),
        tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
        engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [{ ...runOf({ hits: [] }), projection: "not-included" }] }),
      }),
      files: { [DEBT_FILE]: DEBT_DOCUMENT },
    });
    expect({ writes: ran.writes, exits: ran.exits, filesHeld: ran.repository.filesHeld() }).toEqual({
      writes: [[{ text: "claimed-type removed src/a.ts: stale, its file is excluded by the settings\n" }]],
      exits: [[{ code: 0 }]],
      filesHeld: [],
    });
  });

  it("removes the debt once the engine measured its check at its file and found nothing", async () => {
    const measured = { ...runOf({ hits: [] }), measured: [{ clause: CAST_EXPRESSIONS, file: FILE_A }] };
    expect(await prunedWhileEngineRan({ run: measured })).toEqual({
      writes: [[{ text: "claimed-type removed src/a.ts: stale\n" }]],
      exits: [[{ code: 0 }]],
      filesHeld: [],
    });
  });

  it("measures the change only when debt is held, as the check does, and prints nothing when none is shown", async () => {
    const stages = stagesGiving({});
    const ran = await ranWith({ handler: versionTwoPruneDebtCommandOf, arguments: ["--repo", "/repo"], stages, files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]] });
    expect(stages.touched).toHaveBeenCalledWith(expect.objectContaining({ measuring: "when-debt-held" }));
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({ records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }) });
    const ran = await ranWith({ handler: versionTwoPruneDebtCommandOf, arguments: ["--repo", "/repo"], stages, files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: CONFIG_ABSENT_LINE }]], exits: [[{ code: 2 }]] });
  });

  it("prints an arguments-invalid line and builds no stages when the arguments are not readable", async () => {
    const ran = await ranWith({ handler: versionTwoPruneDebtCommandOf, arguments: ["--repo"], stages: stagesGiving({}), files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(ran.stagesOver).not.toHaveBeenCalled();
  });
});

const ACCEPTED_ARGUMENTS = authoriseArgumentsFor({ repo: "/repo", rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types." });

const REFUSED_ARGUMENTS = authoriseArgumentsFor({ repo: "/repo", rootCause: "no" });

const AUTHORISED_FILE = "hone-records/authorised-locations/claimed-type.json";

describe("versionTwoAuthoriseCommandOf", () => {
  it("reads only the catalogue, never running the engines", async () => {
    const stages = stagesGiving({});
    await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: ACCEPTED_ARGUMENTS, stages, files: {} });
    expect(stages.catalogue).toHaveBeenCalled();
    expect(stages.engines).not.toHaveBeenCalled();
  });

  it("writes the location for the symptom and file given, and prints it authorised, exit 0", async () => {
    const ran = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages: stagesGiving({}),
      files: {},
    });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: "claimed-type authorised src/a.ts\n" }]], exits: [[{ code: 0 }]] });
    expect(ran.repository.filesHeld()).toEqual([AUTHORISED_FILE]);
    expect(ran.repository.textOf({ file: AUTHORISED_FILE })).toContain('"file": "src/a.ts"');
  });

  it("prints the location already authorised, writing nothing, when the records hold it", async () => {
    const first = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages: stagesGiving({}),
      files: {},
    });
    const held = first.repository.textOf({ file: AUTHORISED_FILE });
    assert.isDefined(held);
    const second = await ranWith({
      handler: versionTwoAuthoriseCommandOf,
      arguments: ACCEPTED_ARGUMENTS,
      stages: stagesGiving({}),
      files: { [AUTHORISED_FILE]: held },
    });
    expect(second.writes).toEqual([[{ text: `claimed-type already-authorised src/a.ts: ${AUTHORISED_FILE} already holds this record\n` }]]);
    expect(second.repository.textOf({ file: AUTHORISED_FILE })).toBe(held);
  });

  it("prints each refusal and exits 0, writing nothing, when the form refuses the chain", async () => {
    const ran = await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: REFUSED_ARGUMENTS, stages: stagesGiving({}), files: {} });
    expect(ran.exits).toEqual([[{ code: 0 }]]);
    expect(ran.writes).toEqual([[{ text: expect.stringMatching(/^claimed-type refused src\/a\.ts: /) }]]);
    expect(ran.repository.filesHeld()).toEqual([]);
  });

  it("prints the load failure line and exits 2 when the catalogue cannot be read", async () => {
    const stages = stagesGiving({ catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }) });
    const ran = await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: ACCEPTED_ARGUMENTS, stages, files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: CONFIG_ABSENT_LINE }]], exits: [[{ code: 2 }]] });
  });

  it("prints an arguments-invalid line and builds no stages when an option is missing a value", async () => {
    const ran = await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: ["--repo"], stages: stagesGiving({}), files: {} });
    expect({ writes: ran.writes, exits: ran.exits }).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(ran.stagesOver).not.toHaveBeenCalled();
  });
});
