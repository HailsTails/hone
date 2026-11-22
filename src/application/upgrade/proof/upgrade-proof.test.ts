import { describe, expect, it, type Mock, vi } from "vitest";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort, RelativeLocation } from "../../ports/host/path-port.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { RecordAnswerOracle, FileCarveOutRecord } from "../../ports/upgrade/record-answer-oracle.ts";
import type { HeadRecord } from "../../../domain/records/upgrade/head-records.ts";
import { upgradeProof, type UpgradeProofRequest } from "./upgrade-proof.ts";
import type { ProofRuns } from "../../ports/upgrade/proof-runs.ts";
import type { ProjectionFilesOf } from "./upgrade-plan.ts";
import type { VersionOneReading } from "../../ports/upgrade/version-one-reading.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";
import type { VersionOneProjectionsOf, VersionOneProjectionsReading } from "./version-one-projections-reading.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";

type RecordedMock = {
  readonly mock: { readonly calls: readonly (readonly unknown[])[]; readonly invocationCallOrder: readonly number[] };
};

type RecordedCall = { readonly port: string; readonly arguments: readonly unknown[] };

type OrderedCall = RecordedCall & { readonly order: number };

const orderedCallsOf = (request: { readonly port: string; readonly mock: RecordedMock }): readonly OrderedCall[] =>
  request.mock.mock.calls.map((callArguments, index) => ({ port: request.port, arguments: callArguments, order: request.mock.mock.invocationCallOrder[index] }));

const callSequenceOf = (request: { readonly mocks: Readonly<Record<string, RecordedMock>> }): readonly RecordedCall[] =>
  Object.entries(request.mocks)
    .flatMap(([port, mock]) => orderedCallsOf({ port, mock }))
    .toSorted((left, right) => left.order - right.order)
    .map(({ port, arguments: callArguments }) => ({ port, arguments: callArguments }));

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT_ENGINE], forms: [] };

const LOOP_KEYWORD_TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const REBINDING_TEST_BODY: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
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

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: { ...SETTINGS_CATALOGUE, checks: [LOOP_KEYWORD_LOOPS] } }];

const SRC_A = repoPathSchema.parse("src/a.ts");

const REPO = absolutePathSchema.parse("/repo");

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

const ORIGINAL_CONFIG = 'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const READING: VersionOneReading = { selection: SELECTION, heads: [CARVE_OUT_HEAD] };

const ROOT_PROJECTION: VersionOneProjection = {
  projection: repoPathSchema.parse("disciplines.eslint.mjs"),
  teamConfigs: [{ file: repoPathSchema.parse("eslint.config.mjs"), text: ORIGINAL_CONFIG }],
};

const FOUND_PROJECTIONS: VersionOneProjectionsReading = { removed: [], outcome: { outcome: "ok", value: [ROOT_PROJECTION] } };

const ORPHAN = repoPathSchema.parse("old/disciplines.eslint.mjs");

const EMPTY_BEFORE: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const EMPTY_AFTER: RunReport = {
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

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const ok = { outcome: "ok", value: undefined } as const;

const PARENTS = new Map<string, string>([
  ["/repo/hone-records", "/repo"],
  ["/repo/hone-records/debt", "/repo/hone-records"],
  ["/repo/hone-records/debt/loop-keyword.json", "/repo/hone-records/debt"],
  ["/repo/hone.config.json", "/repo"],
  ["/repo/hone.eslint.mjs", "/repo"],
  ["/repo", "/"],
]);

const RELATIVE_LOCATIONS = new Map<string, RelativeLocation>([
  ["/repo /repo/discipline-exceptions.json", { relation: "within-root", path: "discipline-exceptions.json" }],
  ["/repo/discipline-exceptions /repo/discipline-exceptions/cd-15.json", { relation: "within-root", path: "cd-15.json" }],
  ["/repo/discipline-exceptions /repo/tools/x.json", { relation: "within-root", path: "../tools/x.json" }],
]);

const POSIX_PATH: PathPort = {
  join: ({ segments }) => segments.join("/"),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: ({ from, to }) => RELATIVE_LOCATIONS.get(`${from} ${to}`) ?? { relation: "different-root" },
  directoryOf: ({ path }) => PARENTS.get(path) ?? path,
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const SETTINGS_FORMAT: Pick<SettingsFileFormat, "textOf"> = { textOf: () => "the settings format's text" };

type MockedPorts = {
  readonly fileText: { readonly read: Mock<FileTextPort["read"]>; readonly exists: Mock<FileTextPort["exists"]>; readonly write: Mock<FileTextPort["write"]> };
  readonly fileCreation: { readonly createNew: Mock<FileCreationPort["createNew"]> };
  readonly fileRemoval: { readonly remove: Mock<FileRemovalPort["remove"]> };
  readonly directory: { readonly list: Mock<DirectoryPort["list"]>; readonly create: Mock<DirectoryPort["create"]> };
  readonly directoryRemoval: { readonly removeEmpty: Mock<DirectoryRemovalPort["removeEmpty"]> };
  readonly entryKind: { readonly kindOf: Mock<EntryKindPort["kindOf"]> };
  readonly path: UpgradeProofRequest["ports"]["path"];
};

const kindsOfEveryPlannedFileNew = () =>
  vi
    .fn<EntryKindPort["kindOf"]>()
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("directory")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("directory")
    .mockReturnValueOnce("directory");

const kindsOfExistingFirstFile = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file");

const portsOver = (request: { readonly kindOf: Mock<EntryKindPort["kindOf"]> }): MockedPorts => ({
  fileText: {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: ORIGINAL_CONFIG }),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>().mockReturnValue(ok),
  },
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>().mockReturnValue(ok) },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
  directory: { list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] }), create: vi.fn<DirectoryPort["create"]>().mockReturnValue(ok) },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok) },
  entryKind: { kindOf: request.kindOf },
  path: POSIX_PATH,
});

type Doubles = {
  readonly ports: MockedPorts;
  readonly oracle: { readonly answer: Mock<RecordAnswerOracle["answer"]> };
  readonly runs: { readonly versionOne: Mock<ProofRuns["versionOne"]>; readonly versionTwo: Mock<ProofRuns["versionTwo"]> };
  readonly projections: Mock<VersionOneProjectionsOf>;
};

const doublesOver = (request: { readonly kindOf: Mock<EntryKindPort["kindOf"]> }): Doubles => ({
  ports: portsOver(request),
  projections: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(FOUND_PROJECTIONS),
  oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue({ outcome: "ok", value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] }) },
  runs: {
    versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue({ outcome: "ok", value: EMPTY_BEFORE }),
    versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue({ outcome: "ok", value: EMPTY_AFTER }),
  },
});

const ROOT_PROJECTION_FILE = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "projection text" };

const SLICE_PROJECTION_FILE = { file: repoPathSchema.parse("packages/a/hone.eslint.mjs"), text: "slice text" };

const requestOver = (request: { readonly doubles: Doubles }): UpgradeProofRequest => ({
  ports: request.doubles.ports,
  oracle: request.doubles.oracle,
  runs: request.doubles.runs,
  reading: READING,
  versionOneFiles: {
    recordsFiles: [repoPathSchema.parse("discipline-exceptions/cd-15.json")],
    recordsFolders: [],
    recordsRoot: { kind: "folder", folder: repoPathSchema.parse("discipline-exceptions") },
    settings: repoPathSchema.parse("disciplines.json"),
  },
  catalogues: CATALOGUES,
  repoRoot: REPO,
  projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue({ outcome: "ok", value: { files: [ROOT_PROJECTION_FILE], projections: [ROOT_PROJECTION_FILE] } }),
  settingsFormat: SETTINGS_FORMAT,
  versionOneProjectionsOf: request.doubles.projections,
});

const sequenceOf = (request: { readonly doubles: Doubles }) =>
  callSequenceOf({
    mocks: {
      answer: request.doubles.oracle.answer,
      versionOne: request.doubles.runs.versionOne,
      versionTwo: request.doubles.runs.versionTwo,
      projections: request.doubles.projections,
      kindOf: request.doubles.ports.entryKind.kindOf,
      read: request.doubles.ports.fileText.read,
      create: request.doubles.ports.directory.create,
      createNew: request.doubles.ports.fileCreation.createNew,
      write: request.doubles.ports.fileText.write,
      remove: request.doubles.ports.fileRemoval.remove,
      list: request.doubles.ports.directory.list,
      removeEmpty: request.doubles.ports.directoryRemoval.removeEmpty,
    },
  });

const SINGLE_FILE_LAYOUT: UpgradeProofRequest["versionOneFiles"] = {
  recordsFiles: [repoPathSchema.parse("discipline-exceptions.json")],
  recordsFolders: [],
  recordsRoot: { kind: "repository" },
  settings: repoPathSchema.parse("disciplines.json"),
};

const SETTINGS_PATH = "/repo/hone.config.json";

const DEBT_PATH = "/repo/hone-records/debt/loop-keyword.json";

const PROJECTION_PATH = "/repo/hone.eslint.mjs";

const CONFIG_PATH = "/repo/eslint.config.mjs";

const ASKING_THE_ORACLE = [{ port: "answer", arguments: [{ records: [CARVE_OUT] }] }];

const RUNNING_VERSION_ONE = [{ port: "versionOne", arguments: [] }];

const NO_IMPORTER = { kind: "no-file-imports-projection", projection: repoPathSchema.parse("disciplines.eslint.mjs") } as const;


const READING_PROJECTIONS = [{ port: "projections", arguments: [] }];

const RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS = [...RUNNING_VERSION_ONE, ...READING_PROJECTIONS];

const PLANNING_THE_WRITES = [
  { port: "kindOf", arguments: [{ path: SETTINGS_PATH }] },
  { port: "kindOf", arguments: [{ path: DEBT_PATH }] },
  { port: "kindOf", arguments: [{ path: PROJECTION_PATH }] },
  { port: "read", arguments: [{ path: CONFIG_PATH }] },
  { port: "kindOf", arguments: [{ path: "/repo" }] },
  { port: "kindOf", arguments: [{ path: "/repo/hone-records/debt" }] },
  { port: "kindOf", arguments: [{ path: "/repo/hone-records" }] },
  { port: "kindOf", arguments: [{ path: "/repo" }] },
  { port: "kindOf", arguments: [{ path: "/repo" }] },
];

const WRITING = [
  { port: "create", arguments: [{ path: "/repo/hone-records" }] },
  { port: "create", arguments: [{ path: "/repo/hone-records/debt" }] },
  { port: "createNew", arguments: [{ path: SETTINGS_PATH, text: "the settings format's text" }] },
  { port: "createNew", arguments: [{ path: DEBT_PATH, text: expect.any(String) }] },
  { port: "createNew", arguments: [{ path: PROJECTION_PATH, text: "projection text" }] },
  { port: "write", arguments: [{ path: CONFIG_PATH, text: 'import disciplines from "./hone.eslint.mjs";\nexport default [...disciplines];\n' }] },
];

const RUNNING_VERSION_TWO = [{ port: "versionTwo", arguments: [] }];

const ROLLING_BACK = [
  { port: "write", arguments: [{ path: CONFIG_PATH, text: ORIGINAL_CONFIG }] },
  { port: "remove", arguments: [{ path: PROJECTION_PATH }] },
  { port: "remove", arguments: [{ path: DEBT_PATH }] },
  { port: "remove", arguments: [{ path: SETTINGS_PATH }] },
  { port: "removeEmpty", arguments: [{ path: "/repo/hone-records/debt" }] },
  { port: "removeEmpty", arguments: [{ path: "/repo/hone-records" }] },
];

const REMOVING_VERSION_ONE = [
  { port: "remove", arguments: [{ path: "/repo/discipline-exceptions/cd-15.json" }] },
  { port: "list", arguments: [{ path: "/repo/discipline-exceptions" }] },
  { port: "removeEmpty", arguments: [{ path: "/repo/discipline-exceptions" }] },
  { port: "remove", arguments: [{ path: "/repo/disciplines.eslint.mjs" }] },
  { port: "remove", arguments: [{ path: "/repo/disciplines.json" }] },
];

describe("upgradeProof", () => {
  it("writes the version 2 files, finds the two runs equal and removes the version 1 files, in that order", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "ok",
      value: {
        markedNotAdopted: [],
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: ["eslint.config.mjs"],
        removed: {
          files: ["/repo/discipline-exceptions/cd-15.json", "/repo/disciplines.eslint.mjs", "/repo/disciplines.json"],
          folders: ["/repo/discipline-exceptions"],
        },
      },
    });
    expect(sequenceOf({ doubles })).toEqual([
      ...ASKING_THE_ORACLE,
      ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS,
      ...PLANNING_THE_WRITES,
      ...WRITING,
      ...RUNNING_VERSION_TWO,
      ...REMOVING_VERSION_ONE,
    ]);
  });

  it("refuses, before writing anything, a repository version 1 already reports uncovered", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionOne.mockResolvedValue({ outcome: "ok", value: { ...EMPTY_BEFORE, uncovered: [LOOPS_CLAUSE] } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-uncovered", clauses: [LOOPS_CLAUSE], removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE]);
  });

  it("refuses, before running or writing anything, when the oracle cannot answer", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.oracle.answer.mockResolvedValue({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "the eslint runner threw" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "oracle-failed", failure: { kind: "version-one-run-failed", detail: "the eslint runner threw" } },
    });
    expect(sequenceOf({ doubles })).toEqual(ASKING_THE_ORACLE);
  });

  it("refuses, before running or writing anything, a carve-out that answered nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.oracle.answer.mockResolvedValue({ outcome: "ok", value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } }] });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: { kind: "mapping-refused", refusals: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: "src/a.ts", credited: "nothing" }] },
        removedByVersionOne: [],
      },
    });
    expect(sequenceOf({ doubles })).toEqual(ASKING_THE_ORACLE);
  });

  it("refuses, before writing anything, when the version 1 run fails", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionOne.mockResolvedValue({ outcome: "failed", error: { kind: "run-failed", detail: "no selection" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-run-failed", failure: { kind: "run-failed", detail: "no selection" }, removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE]);
  });

  it("refuses, before the second run, when a file it would write already exists", async () => {
    const doubles = doublesOver({ kindOf: kindsOfExistingFirstFile() });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "write-refused", refusal: { failure: { kind: "path-already-exists", path: SETTINGS_PATH }, unrestored: [] }, removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS, { port: "kindOf", arguments: [{ path: SETTINGS_PATH }] }]);
  });

  it("restores what it wrote when the version 2 run fails, and removes nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockResolvedValue({ outcome: "failed", error: { kind: "run-failed", detail: "config unreadable" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "config unreadable" }, unrestored: [], removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("restores what it wrote and names the difference when the two runs do not agree, removing nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockResolvedValue({ outcome: "ok", value: { ...EMPTY_AFTER, findings: [LOOP_FINDING] } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "differences",
        differences: [
          { section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] },
          { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("restores what it wrote and names each directive, before any difference, when version 2 reports a directive naming no check, removing nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockResolvedValue({
      outcome: "ok",
      value: { ...EMPTY_AFTER, findings: [LOOP_FINDING], misnamed: [{ kind: "names-no-check", ruleId: "hone/no-such-check", file: repoPathSchema.parse("src/a.ts"), line: 3, text: "the text" }] },
    });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "directives-name-no-check",
        directives: [{ kind: "names-no-check", ruleId: "hone/no-such-check", file: "src/a.ts", line: 3, text: "the text" }],
        unrestored: [],
        removedByVersionOne: [],
      },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("leaves the version 2 files in place and reports what was removed when a version 1 file cannot be removed", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.ports.fileRemoval.remove.mockReturnValue({ outcome: "failed", error: { kind: "unremovable", path: "/repo/discipline-exceptions/cd-15.json", detail: "EBUSY" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "removal-failed",
        failure: { kind: "unremovable", path: "/repo/discipline-exceptions/cd-15.json", detail: "EBUSY", removed: { files: [], folders: [] } },
        remaining: ["/repo/discipline-exceptions/cd-15.json", "/repo/disciplines.eslint.mjs", "/repo/disciplines.json"],
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: ["eslint.config.mjs"],
      },
    });
    expect(sequenceOf({ doubles })).toEqual([
      ...ASKING_THE_ORACLE,
      ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS,
      ...PLANNING_THE_WRITES,
      ...WRITING,
      ...RUNNING_VERSION_TWO,
      { port: "remove", arguments: [{ path: "/repo/discipline-exceptions/cd-15.json" }] },
    ]);
  });

  it("upgrades a repository whose version 1 records sit in the single file at its root, removing no folder", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    await expect(upgradeProof({ ...requestOver({ doubles }), versionOneFiles: SINGLE_FILE_LAYOUT })).resolves.toEqual({
      outcome: "ok",
      value: {
        markedNotAdopted: [],
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: ["eslint.config.mjs"],
        removed: { files: ["/repo/discipline-exceptions.json", "/repo/disciplines.eslint.mjs", "/repo/disciplines.json"], folders: [] },
      },
    });
    expect(sequenceOf({ doubles })).toEqual([
      ...ASKING_THE_ORACLE,
      ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS,
      ...PLANNING_THE_WRITES,
      ...WRITING,
      ...RUNNING_VERSION_TWO,
      { port: "remove", arguments: [{ path: "/repo/discipline-exceptions.json" }] },
      { port: "remove", arguments: [{ path: "/repo/disciplines.eslint.mjs" }] },
      { port: "remove", arguments: [{ path: "/repo/disciplines.json" }] },
    ]);
  });

  it("refuses, before writing anything, a version 1 records file outside its records folder", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    const request = requestOver({ doubles });
    await expect(upgradeProof({ ...request, versionOneFiles: { ...request.versionOneFiles, recordsFiles: [repoPathSchema.parse("tools/x.json")] } })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "removal-refused", failure: { kind: "records-file-outside-root", path: "/repo/tools/x.json", root: "/repo/discipline-exceptions" }, removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS]);
  });

  it("restores what it wrote when the version 2 run rejects", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockRejectedValue(new Error("the runner threw"));
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "the runner threw" }, unrestored: [], removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("names what it could not restore when the version 2 run rejects and a file cannot be removed", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockRejectedValue(new Error("the runner threw"));
    doubles.ports.fileRemoval.remove.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "unremovable", path: DEBT_PATH, detail: "EBUSY" } }).mockReturnValue(ok);
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "the runner threw" }, unrestored: [{ written: "file-created", path: DEBT_PATH, detail: "EBUSY" }], removedByVersionOne: [] },
    });
  });

  it("refuses without listing anything to restore when the team config is refused and version 1 changed nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [], outcome: { outcome: "failed", error: { kind: "team-config-refused", refusal: NO_IMPORTER } } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "plan-refused", refusal: { kind: "team-config-refused", refusal: NO_IMPORTER }, removedByVersionOne: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS]);
  });

  it("names the slice version 1 removed to restore when the team config is refused after it", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "failed", error: { kind: "team-config-refused", refusal: NO_IMPORTER } } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "plan-refused", refusal: { kind: "team-config-refused", refusal: NO_IMPORTER }, removedByVersionOne: ["old/disciplines.eslint.mjs"] },
    });
  });

  it("names the slice version 1 left in place when it refuses, and the one it removed to restore", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({
      removed: [ORPHAN],
      outcome: { outcome: "failed", error: { kind: "slice-left-in-place", files: [repoPathSchema.parse("stale/disciplines.eslint.mjs")] } },
    });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "plan-refused", refusal: { kind: "slice-left-in-place", files: ["stale/disciplines.eslint.mjs"] }, removedByVersionOne: ["old/disciplines.eslint.mjs"] },
    });
  });

  it("refuses naming what failed when version 1's project fails", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [], outcome: { outcome: "failed", error: { kind: "project-failed", detail: "disk full" } } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-project-failed", detail: "disk full", removedByVersionOne: [] },
    });
  });

  it("refuses naming each file version 1's project rewrote, and the slice it removed, without writing anything", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "failed", error: { kind: "project-rewrote", files: [repoPathSchema.parse("disciplines.eslint.mjs")] } } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-project-rewrote", files: ["disciplines.eslint.mjs"], removedByVersionOne: ["old/disciplines.eslint.mjs"] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE_THEN_READING_PROJECTIONS]);
  });

  it("names the slice version 1 removed when that slice cannot be placed in the repository", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "ok", value: [ROOT_PROJECTION] } });
    const request = requestOver({ doubles });
    const unplaceable = { ...request, ports: { ...request.ports, path: { ...request.ports.path, join: vi.fn<PathPort["join"]>().mockReturnValue("not-absolute") } } };
    await expect(upgradeProof(unplaceable)).resolves.toEqual({
      outcome: "failed",
      error: { kind: "unplaceable-path", file: "old/disciplines.eslint.mjs", removedByVersionOne: ["old/disciplines.eslint.mjs"] },
    });
  });

  it("refuses a version 2 projection no version 1 projection stands behind, naming the slice version 1 removed to restore", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "ok", value: [ROOT_PROJECTION] } });
    const request = {
      ...requestOver({ doubles }),
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue({
        outcome: "ok",
        value: { files: [ROOT_PROJECTION_FILE, SLICE_PROJECTION_FILE], projections: [ROOT_PROJECTION_FILE, SLICE_PROJECTION_FILE] },
      }),
    };
    await expect(upgradeProof(request)).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: { kind: "projections-unpaired", refusal: { kind: "version-two-projection-unpaired", file: "packages/a/hone.eslint.mjs", folder: "packages/a" } },
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    });
  });

  it("names the slice version 1 removed to restore when a file it would write already exists", async () => {
    const doubles = doublesOver({ kindOf: kindsOfExistingFirstFile() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "ok", value: [ROOT_PROJECTION] } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "write-refused", refusal: { failure: { kind: "path-already-exists", path: SETTINGS_PATH }, unrestored: [] }, removedByVersionOne: ["old/disciplines.eslint.mjs"] },
    });
  });

  it("names the slice version 1 removed to restore, with what it rolled back, when the version 2 run fails", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "ok", value: [ROOT_PROJECTION] } });
    doubles.runs.versionTwo.mockResolvedValue({ outcome: "failed", error: { kind: "run-failed", detail: "config unreadable" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "config unreadable" }, unrestored: [], removedByVersionOne: ["old/disciplines.eslint.mjs"] },
    });
  });

  it("lists the slice version 1 removed among the version 1 files removed, first", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.projections.mockResolvedValue({ removed: [ORPHAN], outcome: { outcome: "ok", value: [ROOT_PROJECTION] } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "ok",
      value: {
        markedNotAdopted: [],
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: ["eslint.config.mjs"],
        removed: {
          files: ["/repo/old/disciplines.eslint.mjs", "/repo/discipline-exceptions/cd-15.json", "/repo/disciplines.eslint.mjs", "/repo/disciplines.json"],
          folders: ["/repo/discipline-exceptions"],
        },
      },
    });
  });

  it("reports what it wrote and what it had removed, and leaves the version 2 files, when removing a version 1 file throws", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.ports.fileRemoval.remove.mockReturnValueOnce(ok).mockThrowOnce(new Error("the removal threw"));
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "removal-failed",
        failure: {
          kind: "unremovable",
          path: "/repo/disciplines.eslint.mjs",
          detail: "the removal threw",
          removed: { files: ["/repo/discipline-exceptions/cd-15.json"], folders: ["/repo/discipline-exceptions"] },
        },
        remaining: ["/repo/disciplines.eslint.mjs", "/repo/disciplines.json"],
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: ["eslint.config.mjs"],
      },
    });
  });
});
