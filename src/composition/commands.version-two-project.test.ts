import { describe, expect, it, vi } from "vitest";
import type { Case, Check, Engine, Pointed, Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { ProjectedFile } from "../domain/runner/checks-run-report.ts";
import type { RecordsReading } from "../domain/records/hone-records/hone-record.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../domain/settings/conventions.ts";
import type { SettingsReading } from "../application/run/settings/read-settings.ts";
import { commandOf } from "./composed-command.ts";
import { VERSION_TWO_PROJECT } from "./commands.ts";
import type { CommandRequest } from "../application/ports/command-request.ts";
import type { VersionTwoRepositoryPorts } from "./version-two-repository.ts";
import type { StagesOver } from "./version-two-stages.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";

const versionTwoProjectCommandOf = (ports: Omit<VersionTwoRepositoryPorts, keyof CommandRequest>) => (command: CommandRequest) =>
  commandOf({ tool: VERSION_TWO_PROJECT, ports: { ...command, ...ports } })(command);

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const CLOCK_SOURCES = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-17"), clause: clauseIdOf("clock-sources") };

const TEST_BODY_LOGIC = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") };

const CAST_EXPRESSIONS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") };

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

type Command = CommandRequest;

const FILE: ProjectedFile = { file: repoPathOf("hone.eslint.mjs"), text: "export default [];\n" };

const SETTINGS: SettingsReading = {
  available: [],
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const stagesProjecting = (request: { readonly projected: Awaited<ReturnType<VersionTwoStages["projections"]>> }): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>(),
  projections: vi.fn<VersionTwoStages["projections"]>().mockResolvedValue(request.projected),
  touched: vi.fn<VersionTwoStages["touched"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const ENTRY_URL = "file:///install/src/hone.ts";

const fileTextAbsent = (): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const fileTextHolding = (request: { readonly current: string }): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.current }),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const commandWith = (request: { readonly process: ProcessPort; readonly moduleUrl: string; readonly fileText: FileTextPort }): Command => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  engine: createDefaultEnginePort({}),
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  moduleUrl: request.moduleUrl,
});

const ranWith = async (request: { readonly arguments: readonly string[]; readonly stagesOver: StagesOver; readonly moduleUrl: string; readonly fileText: FileTextPort }) => {
  const processPort = processWith({ arguments: request.arguments });
  const { fileText } = request;
  await versionTwoProjectCommandOf({
    gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
    directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
    recordsSourceOf: vi.fn<RecordsSourceOf>(),
    stagesOver: request.stagesOver,
  })(commandWith({ process: processPort, moduleUrl: request.moduleUrl, fileText }));
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const stagesOverProjecting = (request: { readonly projected: Awaited<ReturnType<VersionTwoStages["projections"]>> }) =>
  vi.fn<StagesOver>().mockReturnValue(stagesProjecting(request));

describe("versionTwoProjectCommandOf", () => {
  it("writes each file the engines project into the repository, prints it as written, and exits 0", async () => {
    const fileText = fileTextAbsent();
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText, stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [FILE] } }) });
    expect({ ran, written: vi.mocked(fileText.write).mock.calls }).toEqual({
      ran: { writes: [[{ text: "hone.eslint.mjs written\n" }]], exits: [[{ code: 0 }]] },
      written: [[{ path: "/repo/hone.eslint.mjs", text: "export default [];\n" }]],
    });
  });

  it("prints a file already holding the projected text as unchanged, and writes nothing", async () => {
    const fileText = fileTextHolding({ current: "export default [];\n" });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText, stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [FILE] } }) });
    expect({ ran, written: vi.mocked(fileText.write).mock.calls }).toEqual({
      ran: { writes: [[{ text: "hone.eslint.mjs unchanged\n" }]], exits: [[{ code: 0 }]] },
      written: [],
    });
  });

  it("prints the file-unwritable line and exits 2 when a file cannot be written", async () => {
    const fileText: FileTextPort = {
      ...fileTextAbsent(),
      write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "failed", error: { kind: "unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" } }),
    };
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText, stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [FILE] } }) });
    expect(ran).toEqual({ writes: [[{ text: "load failure: file-unwritable /repo/hone.eslint.mjs ENOSPC\n" }]], exits: [[{ code: 2 }]] });
  });

  it("prints nothing and exits 0 when no engine has a file to project", async () => {
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [] } }) });
    expect(ran).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]] });
  });

  it("builds the stages over the repository and the install the command runs from, with no base revision", async () => {
    const stagesOver = stagesOverProjecting({ projected: { outcome: "ok", value: [] } });
    await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver });
    expect(stagesOver).toHaveBeenCalledWith(expect.objectContaining({ locations: { repoRoot: "/repo", installRoot: "/install", moduleExtension: ".ts", baseRevision: undefined } }));
  });

  it("prints the not-ready-yet line and exits 2 when the engine's config roots are not ready", async () => {
    const notReady: RunLoadFailure = { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } };
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver: stagesOverProjecting({ projected: { outcome: "failed", error: notReady } }) });
    expect(ran).toEqual({
      writes: [[{ text: "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: packages/web; move them out of this repository, and run each on its own with --repo\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints the failure of the engine's runner and exits 2", async () => {
    const failed: RunLoadFailure = { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "disk full" } };
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver: stagesOverProjecting({ projected: { outcome: "failed", error: failed } }) });
    expect(ran).toEqual({ writes: [[{ text: "load failure: engine-failed eslint tool-failed disk full\n" }]], exits: [[{ code: 2 }]] });
  });

  it("prints the install-root-unresolvable line as it is, and exits 2, building no stages, when the command was not started from a file", async () => {
    const stagesOver = stagesOverProjecting({ projected: { outcome: "ok", value: [] } });
    const ran = await ranWith({ moduleUrl: "https://example.com/tool-command.js", arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver });
    expect(ran).toEqual({ writes: [[{ text: "load failure: install-root-unresolvable https://example.com/tool-command.js the text is not a file: URL\n" }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });

  it("prints an arguments-invalid line, exits 2 and builds no stages when the arguments are not readable", async () => {
    const stagesOver = stagesOverProjecting({ projected: { outcome: "ok", value: [] } });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo"], fileText: fileTextAbsent(), stagesOver });
    expect(ran).toEqual({ writes: [[{ text: "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n" }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});
