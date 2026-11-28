import { describe, expect, it, vi } from "vitest";

import type { CheckFinding } from "../../../domain/finding/governance.ts";
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
import type { PrunableDebt } from "../../../domain/records/debt/prunable-debt.ts";
import type { HeadRecord } from "../../../domain/records/upgrade/head-records.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort, RelativeLocation } from "../../ports/host/path-port.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import type { EffectsApplied, ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { ProofRuns } from "../../ports/upgrade/proof-runs.ts";
import type {
  RecordAnswerOracle,
  FileCarveOutRecord,
} from "../../ports/upgrade/record-answer-oracle.ts";
import type { SmoothingCommands } from "../../ports/upgrade/smoothing-commands.ts";
import type { VersionOneReading } from "../../ports/upgrade/version-one-reading.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";
import type { ProjectionFilesOf } from "./upgrade-plan.ts";
import { upgradeProof, type UpgradeProofRequest } from "./upgrade-proof.ts";
import type {
  VersionOneProjectionsOf,
  VersionOneProjectionsReading,
} from "./version-one-projections-reading.ts";

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

const REPO = absoluteRootOf("/repo");

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

const ORIGINAL_CONFIG =
  'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const READING: VersionOneReading = { selection: SELECTION, heads: [CARVE_OUT_HEAD] };

const ROOT_PROJECTION: VersionOneProjection = {
  projection: repoPathOf("disciplines.eslint.mjs"),
  teamConfigs: [{ file: repoPathOf("eslint.config.mjs"), text: ORIGINAL_CONFIG }],
};

const FOUND_PROJECTIONS: VersionOneProjectionsReading = {
  written: [],
  removed: [],
  outcome: { outcome: "ok", value: [ROOT_PROJECTION] },
};

const ORPHAN = repoPathOf("old/disciplines.eslint.mjs");

const EMPTY_AFTER: RunReport = {
  judged: "touched-debt",
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  held: [],
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

const NAMED_LOOP_FINDING: CheckFinding = {
  ruleSet: TOOL_RULE_SET,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const DEBT_LINE = {
  recordKind: "file-carve-out",
  clause: LOOPS_CLAUSE,
  file: repoPathOf("src/a.ts"),
  newKind: "debt",
  check: LOOP_KEYWORD_LOOPS,
  holding: "stated",
} as const;

const IN_RECORDS_FOLDER: RelativeLocation = { relation: "within-root", path: "cd-15.json" };

const IN_REPOSITORY_ROOT: RelativeLocation = {
  relation: "within-root",
  path: "discipline-exceptions.json",
};

const OUTSIDE_RECORDS_FOLDER: RelativeLocation = {
  relation: "within-root",
  path: "../tools/x.json",
};

const pathOver = (request: {
  readonly join: PathPort["join"];
  readonly relative: PathPort["relative"];
}): PathPort => ({
  join: request.join,
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: request.relative,
  directoryOf: vi
    .fn<PathPort["directoryOf"]>()
    .mockReturnValueOnce("/repo")
    .mockReturnValueOnce("/repo/hone-records/debt")
    .mockReturnValueOnce("/repo/hone-records")
    .mockReturnValueOnce("/repo")
    .mockReturnValueOnce("/repo"),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

const joiningRecordsFolderFiles = () =>
  vi
    .fn<PathPort["join"]>()
    .mockReturnValueOnce("/repo/hone.config.json")
    .mockReturnValueOnce("/repo/hone-records/debt/loop-keyword.json")
    .mockReturnValueOnce("/repo/hone.eslint.mjs")
    .mockReturnValueOnce("/repo/eslint.config.mjs")
    .mockReturnValueOnce("/repo/discipline-exceptions/cd-15.json")
    .mockReturnValueOnce("/repo/discipline-exceptions")
    .mockReturnValueOnce("/repo/disciplines.eslint.mjs")
    .mockReturnValueOnce("/repo/disciplines.json");

const recordsFolderPath = () =>
  pathOver({
    join: joiningRecordsFolderFiles(),
    relative: vi.fn<PathPort["relative"]>().mockReturnValue(IN_RECORDS_FOLDER),
  });

const teamRuleSetPath = () =>
  pathOver({
    join: vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/repo/hone.config.json")
      .mockReturnValueOnce("/repo/hone-records/debt/loop-keyword.json")
      .mockReturnValueOnce("/repo/hone.eslint.mjs")
      .mockReturnValueOnce("/repo/eslint.config.mjs")
      .mockReturnValueOnce("/repo/discipline-exceptions/cd-15.json")
      .mockReturnValueOnce("/repo/acme/rules/ACME-1/discipline.json")
      .mockReturnValueOnce("/repo/acme/rules/ACME-1")
      .mockReturnValueOnce("/repo/discipline-exceptions")
      .mockReturnValueOnce("/repo/disciplines.eslint.mjs")
      .mockReturnValueOnce("/repo/disciplines.json"),
    relative: vi.fn<PathPort["relative"]>().mockReturnValue(IN_RECORDS_FOLDER),
  });

const sliceFirstPath = () =>
  pathOver({
    join: vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/repo/old/disciplines.eslint.mjs")
      .mockReturnValueOnce("/repo/hone.config.json")
      .mockReturnValueOnce("/repo/hone-records/debt/loop-keyword.json")
      .mockReturnValueOnce("/repo/hone.eslint.mjs")
      .mockReturnValueOnce("/repo/eslint.config.mjs")
      .mockReturnValueOnce("/repo/discipline-exceptions/cd-15.json")
      .mockReturnValueOnce("/repo/discipline-exceptions")
      .mockReturnValueOnce("/repo/disciplines.eslint.mjs")
      .mockReturnValueOnce("/repo/disciplines.json"),
    relative: vi.fn<PathPort["relative"]>().mockReturnValue(IN_RECORDS_FOLDER),
  });

const repositoryRootPath = () =>
  pathOver({
    join: vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/repo/hone.config.json")
      .mockReturnValueOnce("/repo/hone-records/debt/loop-keyword.json")
      .mockReturnValueOnce("/repo/hone.eslint.mjs")
      .mockReturnValueOnce("/repo/eslint.config.mjs")
      .mockReturnValueOnce("/repo/discipline-exceptions.json")
      .mockReturnValueOnce("/repo/disciplines.eslint.mjs")
      .mockReturnValueOnce("/repo/disciplines.json"),
    relative: vi.fn<PathPort["relative"]>().mockReturnValue(IN_REPOSITORY_ROOT),
  });

const outsideRecordsFolderPath = () =>
  pathOver({
    join: vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/repo/hone.config.json")
      .mockReturnValueOnce("/repo/hone-records/debt/loop-keyword.json")
      .mockReturnValueOnce("/repo/hone.eslint.mjs")
      .mockReturnValueOnce("/repo/eslint.config.mjs")
      .mockReturnValueOnce("/repo/tools/x.json")
      .mockReturnValueOnce("/repo/discipline-exceptions")
      .mockReturnValueOnce("/repo/disciplines.eslint.mjs")
      .mockReturnValueOnce("/repo/disciplines.json"),
    relative: vi.fn<PathPort["relative"]>().mockReturnValue(OUTSIDE_RECORDS_FOLDER),
  });

const SETTINGS_FORMAT: Pick<SettingsFileFormat, "textOf"> = {
  textOf: () => "the settings format's text",
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

const ROOT_PROJECTION_FILE = { file: repoPathOf("hone.eslint.mjs"), text: "projection text" };

const SLICE_PROJECTION_FILE = {
  file: repoPathOf("packages/a/hone.eslint.mjs"),
  text: "slice text",
};

const SINGLE_FILE_LAYOUT: UpgradeProofRequest["versionOneFiles"] = {
  recordsFiles: [repoPathOf("discipline-exceptions.json")],
  recordsFolders: [],
  recordsRoot: { kind: "repository" },
  settings: repoPathOf("disciplines.json"),
};

const NO_IMPORTER = {
  kind: "no-file-imports-projection",
  projection: repoPathOf("disciplines.eslint.mjs"),
} as const;

const SETTINGS_PATH = absoluteRootOf("/repo/hone.config.json");

const DEBT_PATH = absoluteRootOf("/repo/hone-records/debt/loop-keyword.json");

const PROJECTION_PATH = absoluteRootOf("/repo/hone.eslint.mjs");

const CONFIG_PATH = absoluteRootOf("/repo/eslint.config.mjs");

const RECORDS_FOLDER = absoluteRootOf("/repo/hone-records");

const DEBT_FOLDER = absoluteRootOf("/repo/hone-records/debt");

const CARVE_OUT_FILE = absoluteRootOf("/repo/discipline-exceptions/cd-15.json");

const VERSION_ONE_RECORDS_FOLDER = absoluteRootOf("/repo/discipline-exceptions");

const VERSION_ONE_PROJECTION = absoluteRootOf("/repo/disciplines.eslint.mjs");

const VERSION_ONE_SETTINGS = absoluteRootOf("/repo/disciplines.json");

const REWRITTEN_CONFIG =
  'import disciplines from "./hone.eslint.mjs";\nexport default [...disciplines];\n';

const WRITTEN_FILES = [
  repoPathOf("hone.config.json"),
  repoPathOf("hone-records/debt/loop-keyword.json"),
  repoPathOf("hone.eslint.mjs"),
];

const CONFIG_READ = { outcome: "ok", value: ORIGINAL_CONFIG } as const;

const ANSWERED: Awaited<ReturnType<RecordAnswerOracle["answer"]>> = {
  outcome: "ok",
  value: [
    {
      kind: "file-carve-out",
      record: CARVE_OUT,
      answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] },
    },
  ],
};

const VERSION_ONE_PASSING = {
  outcome: "ok",
  value: {
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
  },
} as const;

const AFTER_RUN = { outcome: "ok", value: { report: EMPTY_AFTER, failing: [] } } as const;

const NOTHING_CHANGED = { write: [], remove: [] };

const PRUNED_DEBT: PrunableDebt = {
  place: { file: repoPathOf("hone-records/debt/loop-keyword.json"), index: 0 },
  debt: {
    kind: "debt",
    symptom: LOOP_KEYWORD,
    reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS },
    file: repoPathOf("src/gone.ts"),
    holding: { held: "stated" },
  },
  reason: "file-gone",
};

const ROOT_PROJECTION_FILES: Awaited<ReturnType<ProjectionFilesOf>> = {
  outcome: "ok",
  value: {
    entries: [{ ...ROOT_PROJECTION_FILE, kind: "write" }],
    projections: [ROOT_PROJECTION_FILE],
  },
};

const SLICE_REMOVED: VersionOneProjectionsReading = {
  written: [],
  removed: [ORPHAN],
  outcome: { outcome: "ok", value: [ROOT_PROJECTION] },
};

const VERSION_ONE_REPOSITORY: Pick<
  UpgradeProofRequest,
  | "reading"
  | "versionOneFiles"
  | "catalogues"
  | "repoRoot"
  | "trackedPaths"
  | "settingsFormat"
  | "ruleSetLayout"
  | "smoothing"
> = {
  reading: READING,
  versionOneFiles: {
    recordsFiles: [repoPathOf("discipline-exceptions/cd-15.json")],
    recordsFolders: [],
    recordsRoot: { kind: "folder", folder: repoPathOf("discipline-exceptions") },
    settings: repoPathOf("disciplines.json"),
  },
  catalogues: CATALOGUES,
  repoRoot: REPO,
  trackedPaths: [],
  settingsFormat: SETTINGS_FORMAT,
  ruleSetLayout: { removed: [], folders: [] },
  smoothing: {
    project: vi
      .fn<SmoothingCommands["project"]>()
      .mockResolvedValue({ outcome: "ok", value: NOTHING_CHANGED }),
    removeCarried: vi
      .fn<SmoothingCommands["removeCarried"]>()
      .mockResolvedValue({ outcome: "ok", value: { changes: NOTHING_CHANGED, done: [] } }),
    recordDebt: vi
      .fn<SmoothingCommands["recordDebt"]>()
      .mockResolvedValue({ outcome: "ok", value: { changes: NOTHING_CHANGED, done: [] } }),
    pruneDebt: vi
      .fn<SmoothingCommands["pruneDebt"]>()
      .mockResolvedValue({ outcome: "ok", value: { changes: NOTHING_CHANGED, done: [] } }),
  },
};

const NOTHING_PATCHED: EffectsApplied = { outcome: "all-applied", settled: [] };

const PATCHING_NOTHING = { effects: [] };

const WRITING = {
  effects: [
    { kind: "create-directory", path: RECORDS_FOLDER },
    { kind: "create-directory", path: DEBT_FOLDER },
    { kind: "create-file", path: SETTINGS_PATH, text: "the settings format's text" },
    { kind: "create-file", path: DEBT_PATH, text: expect.any(String) },
    { kind: "create-file", path: PROJECTION_PATH, text: "projection text" },
    { kind: "replace-file", path: CONFIG_PATH, text: REWRITTEN_CONFIG, original: ORIGINAL_CONFIG },
  ],
};

const ALL_WRITTEN: EffectsApplied = {
  outcome: "all-applied",
  settled: [
    { effect: { kind: "create-directory", path: RECORDS_FOLDER }, outcome: "applied" },
    { effect: { kind: "create-directory", path: DEBT_FOLDER }, outcome: "applied" },
    {
      effect: { kind: "create-file", path: SETTINGS_PATH, text: "the settings format's text" },
      outcome: "applied",
    },
    { effect: { kind: "create-file", path: DEBT_PATH, text: "debt records" }, outcome: "applied" },
    {
      effect: { kind: "create-file", path: PROJECTION_PATH, text: "projection text" },
      outcome: "applied",
    },
    {
      effect: {
        kind: "replace-file",
        path: CONFIG_PATH,
        text: REWRITTEN_CONFIG,
        original: ORIGINAL_CONFIG,
      },
      outcome: "applied",
    },
  ],
};

const ROLLING_BACK = {
  writes: [
    { kind: "file-replaced", path: CONFIG_PATH, original: ORIGINAL_CONFIG },
    { kind: "file-created", path: PROJECTION_PATH },
    { kind: "file-created", path: DEBT_PATH },
    { kind: "file-created", path: SETTINGS_PATH },
    { kind: "directory-created", path: DEBT_FOLDER },
    { kind: "directory-created", path: RECORDS_FOLDER },
  ],
};

const CREATED_SLICE = absoluteRootOf("/repo/packages/a/disciplines.eslint.mjs");

const NOTHING_TO_RESTORE = { writes: [] };

const REMOVING_VERSION_ONE = {
  effects: [
    { kind: "remove-file", path: CARVE_OUT_FILE },
    { kind: "remove-directory-if-empty", path: VERSION_ONE_RECORDS_FOLDER },
    { kind: "remove-file", path: VERSION_ONE_PROJECTION },
    { kind: "remove-file", path: VERSION_ONE_SETTINGS },
  ],
};

const VERSION_ONE_REMOVED: EffectsApplied = {
  outcome: "all-applied",
  settled: [
    { effect: { kind: "remove-file", path: CARVE_OUT_FILE }, outcome: "applied" },
    {
      effect: { kind: "remove-directory-if-empty", path: VERSION_ONE_RECORDS_FOLDER },
      outcome: "applied",
    },
    { effect: { kind: "remove-file", path: VERSION_ONE_PROJECTION }, outcome: "applied" },
    { effect: { kind: "remove-file", path: VERSION_ONE_SETTINGS }, outcome: "applied" },
  ],
};

const CARRIED_OVER = {
  written: WRITTEN_FILES,
  replaced: ["eslint.config.mjs"],
  removed: {
    files: [CARVE_OUT_FILE, VERSION_ONE_PROJECTION, VERSION_ONE_SETTINGS],
    folders: [VERSION_ONE_RECORDS_FOLDER],
  },
  records: [DEBT_LINE],
  smoothed: { removedCarried: [], recordedDebt: [], prunedDebt: [], projected: [] },
};

describe("upgradeProof", () => {
  it("writes the version 2 files, smooths them, finds version 2's check passes over what it wrote and removes the version 1 files", async () => {
    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: recordsFolderPath(),
        },
        effects: {
          apply: vi
            .fn<ProofEffects["apply"]>()
            .mockReturnValueOnce(NOTHING_PATCHED)
            .mockReturnValueOnce(ALL_WRITTEN)
            .mockReturnValueOnce(VERSION_ONE_REMOVED),
          undo: vi.fn<ProofEffects["undo"]>(),
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toEqual({ outcome: "ok", value: CARRIED_OVER });
  });

  it("asks the oracle about each record, applies the patching, then the writes and obsolete projection removal, runs version 2 over every file it created, then applies the removal, undoing nothing", async () => {
    const obsolete = {
      kind: "remove-restorable-file",
      path: absoluteRootOf("/repo/hone.eslint.ts"),
      original: CONFIG_READ.value,
    } as const;
    const answer = vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED);
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce({
        ...ALL_WRITTEN,
        settled: [...ALL_WRITTEN.settled, { effect: obsolete, outcome: "applied" }],
      })
      .mockReturnValueOnce(VERSION_ONE_REMOVED);
    const undo = vi.fn<ProofEffects["undo"]>();
    const versionTwo = vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN);

    await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: {
          ...recordsFolderPath(),
          join: joiningRecordsFolderFiles().mockReturnValueOnce("/repo/hone.eslint.ts"),
        },
      },
      effects: { apply, undo },
      oracle: { answer },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo,
      },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue({
        outcome: "ok",
        value: {
          projections: [ROOT_PROJECTION_FILE],
          entries: [
            { ...ROOT_PROJECTION_FILE, kind: "write" },
            { kind: "remove", file: repoPathOf("hone.eslint.ts") },
          ],
        },
      }),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect([answer.mock.calls, apply.mock.calls, versionTwo.mock.calls, undo.mock.calls]).toEqual([
      [[{ records: [CARVE_OUT] }]],
      [[PATCHING_NOTHING], [{ effects: [...WRITING.effects, obsolete] }], [REMOVING_VERSION_ONE]],
      [[{ written: WRITTEN_FILES }]],
      [],
    ]);
  });

  it("asks whether each planned file and each of its folders exists, and reads the config it replaces, before writing", async () => {
    const kindOf = kindsOfEveryPlannedFileNew();
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ);

    await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: { read, exists: vi.fn<FileTextPort["exists"]>() },
        entryKind: { kindOf },
        path: recordsFolderPath(),
      },
      effects: {
        apply: vi
          .fn<ProofEffects["apply"]>()
          .mockReturnValueOnce(NOTHING_PATCHED)
          .mockReturnValueOnce(ALL_WRITTEN)
          .mockReturnValueOnce(VERSION_ONE_REMOVED),
        undo: vi.fn<ProofEffects["undo"]>(),
      },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
      },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect([kindOf.mock.calls, read.mock.calls]).toEqual([
      [
        [{ path: SETTINGS_PATH }],
        [{ path: DEBT_PATH }],
        [{ path: PROJECTION_PATH }],
        [{ path: REPO }],
        [{ path: DEBT_FOLDER }],
        [{ path: RECORDS_FOLDER }],
        [{ path: REPO }],
        [{ path: REPO }],
      ],
      [[{ path: CONFIG_PATH }]],
    ]);
  });

  it("removes a team rule set's version 1 files after the settings file, then the team folders it emptied", async () => {
    const teamRule = absoluteRootOf("/repo/acme/rules/ACME-1/discipline.json");
    const teamFolder = absoluteRootOf("/repo/acme/rules/ACME-1");
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce(ALL_WRITTEN)
      .mockReturnValueOnce({
        outcome: "all-applied",
        settled: [
          ...VERSION_ONE_REMOVED.settled,
          { effect: { kind: "remove-file", path: teamRule }, outcome: "applied" },
          { effect: { kind: "remove-directory-if-empty", path: teamFolder }, outcome: "applied" },
        ],
      });

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: teamRuleSetPath(),
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
        ruleSetLayout: {
          removed: [repoPathOf("acme/rules/ACME-1/discipline.json")],
          folders: [repoPathOf("acme/rules/ACME-1")],
        },
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        removed: {
          files: [CARVE_OUT_FILE, VERSION_ONE_PROJECTION, VERSION_ONE_SETTINGS, teamRule],
          folders: [VERSION_ONE_RECORDS_FOLDER, teamFolder],
        },
      },
    });
    expect(apply.mock.calls[2]).toEqual([
      {
        effects: [
          ...REMOVING_VERSION_ONE.effects,
          { kind: "remove-file", path: teamRule },
          { kind: "remove-directory-if-empty", path: teamFolder },
        ],
      },
    ]);
  });

  it("removes the declaration file beside a version 1 projection with the projection", async () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present");
    const declaration = absoluteRootOf("/repo/disciplines.eslint.d.mts");
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce(ALL_WRITTEN)
      .mockReturnValueOnce(VERSION_ONE_REMOVED);

    await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: { read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ), exists },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: recordsFolderPath(),
      },
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
      },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect([exists.mock.calls, apply.mock.calls[2]]).toEqual([
      [[{ path: declaration }]],
      [
        {
          effects: [
            { kind: "remove-file", path: CARVE_OUT_FILE },
            { kind: "remove-directory-if-empty", path: VERSION_ONE_RECORDS_FOLDER },
            { kind: "remove-file", path: VERSION_ONE_PROJECTION },
            { kind: "remove-file", path: declaration },
            { kind: "remove-file", path: VERSION_ONE_SETTINGS },
          ],
        },
      ],
    ]);
  });

  it.each([
    {
      name: "a repository version 1 already reports uncovered",
      answered: ANSWERED,
      before: {
        outcome: "ok",
        value: { ...VERSION_ONE_PASSING.value, uncovered: [LOOPS_CLAUSE] },
      },
      error: { kind: "version-one-uncovered", clauses: [LOOPS_CLAUSE], removedByVersionOne: [] },
      versionOneRuns: [[]],
    },
    {
      name: "a version 1 run that fails",
      answered: ANSWERED,
      before: { outcome: "failed", error: { kind: "run-failed", detail: "no selection" } },
      error: {
        kind: "version-one-run-failed",
        failure: { kind: "run-failed", detail: "no selection" },
        removedByVersionOne: [],
      },
      versionOneRuns: [[]],
    },
    {
      name: "an oracle that cannot answer",
      answered: {
        outcome: "failed",
        error: { kind: "version-one-run-failed", detail: "the eslint runner threw" },
      },
      before: VERSION_ONE_PASSING,
      error: {
        kind: "oracle-failed",
        failure: { kind: "version-one-run-failed", detail: "the eslint runner threw" },
        removedByVersionOne: [],
      },
      versionOneRuns: [],
    },
    {
      name: "a doubly held pair",
      answered: {
        outcome: "failed",
        error: { kind: "record-doubly-held", clause: "CD-15#loops", file: repoPathOf("src/a.ts") },
      },
      before: VERSION_ONE_PASSING,
      error: {
        kind: "oracle-failed",
        failure: {
          kind: "record-doubly-held",
          clause: "CD-15#loops",
          file: repoPathOf("src/a.ts"),
        },
        removedByVersionOne: [],
      },
      versionOneRuns: [],
    },
  ] as const)(
    "refuses, writing nothing more and undoing what version 1's own project rewrote and created, $name",
    async ({ answered, before, error, versionOneRuns }) => {
      const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED);
      const versionOne = vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(before);
      const versionTwo = vi.fn<ProofRuns["versionTwo"]>();
      const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);
      const answer = vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(answered);
      const versionOneProjectionsOf = vi.fn<VersionOneProjectionsOf>().mockResolvedValue({
        ...FOUND_PROJECTIONS,
        written: [
          { kind: "file-replaced", path: VERSION_ONE_PROJECTION, original: "drifted" },
          { kind: "file-created", path: CREATED_SLICE },
        ],
      });

      const proven = await upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>(),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
          path: recordsFolderPath(),
        },
        effects: { apply, undo },
        oracle: { answer },
        runs: { versionOne, versionTwo },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf,
      });

      expect({
        proven,
        versionOneRuns: versionOne.mock.calls,
        versionTwoRuns: versionTwo.mock.calls,
        projectedBeforeMeasuring:
          versionOneProjectionsOf.mock.invocationCallOrder[0] < answer.mock.invocationCallOrder[0],
        undone: undo.mock.calls,
        applied: apply.mock.calls,
      }).toEqual({
        proven: { outcome: "failed", error },
        versionOneRuns,
        versionTwoRuns: [],
        projectedBeforeMeasuring: true,
        undone: [
          [
            {
              writes: [
                { kind: "file-created", path: CREATED_SLICE },
                { kind: "file-replaced", path: VERSION_ONE_PROJECTION, original: "drifted" },
              ],
            },
          ],
        ],
        applied: [[PATCHING_NOTHING]],
      });
    },
  );

  it.each([
    {
      name: "a finding",
      found: {
        findings: [
          {
            clause: LOOPS_CLAUSE,
            file: repoPathOf("src/a.ts"),
            anchor: { line: 3, column: 1 },
            snippet: "loop at the anchor",
            mechanism: AUDIT,
          },
        ],
      },
    },
    {
      name: "an unrecorded exception",
      found: {
        unrecorded: [
          {
            kind: "config-override",
            clause: LOOPS_CLAUSE,
            file: repoPathOf("src/a.ts"),
            mechanism: AUDIT,
          },
        ],
      },
    },
    { name: "a stale record", found: { stale: [CARVE_OUT] } },
  ] as const)("continues to version 2's check over version 1's $name", async ({ found }) => {
    const versionTwo = vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN);

    const proven = await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: recordsFolderPath(),
      },
      effects: {
        apply: vi
          .fn<ProofEffects["apply"]>()
          .mockReturnValueOnce(NOTHING_PATCHED)
          .mockReturnValueOnce(ALL_WRITTEN)
          .mockReturnValueOnce(VERSION_ONE_REMOVED),
        undo: vi.fn<ProofEffects["undo"]>(),
      },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue({
          outcome: "ok",
          value: { ...VERSION_ONE_PASSING.value, ...found },
        }),
        versionTwo,
      },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect({ proven, checkedOver: versionTwo.mock.calls }).toEqual({
      proven: { outcome: "ok", value: CARRIED_OVER },
      checkedOver: [[{ written: WRITTEN_FILES }]],
    });
  });

  it("refuses, writing nothing and running nothing more, when a file it would write already exists", async () => {
    const kindOf = kindsOfExistingFirstFile();
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED);
    const versionTwo = vi.fn<ProofRuns["versionTwo"]>();

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf },
          path: recordsFolderPath(),
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]) },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo,
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "write-refused",
        refusal: { failure: { kind: "path-already-exists", path: SETTINGS_PATH }, unrestored: [] },
        removedByVersionOne: [],
      },
    });
    expect([kindOf.mock.calls, apply.mock.calls, versionTwo.mock.calls]).toEqual([
      [[{ path: SETTINGS_PATH }]],
      [[PATCHING_NOTHING]],
      [],
    ]);
  });

  it("undoes what it wrote, newest first, when the version 2 run fails, and removes nothing", async () => {
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce(ALL_WRITTEN);
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: recordsFolderPath(),
        },
        effects: { apply, undo },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue({
            outcome: "failed",
            error: { kind: "run-failed", detail: "config unreadable" },
          }),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "version-two-run-failed",
        failure: { kind: "run-failed", detail: "config unreadable" },
        unrestored: [],
        removedByVersionOne: [],
      },
    });
    expect([apply.mock.calls, undo.mock.calls]).toEqual([
      [[PATCHING_NOTHING], [WRITING]],
      [[ROLLING_BACK], [NOTHING_TO_RESTORE]],
    ]);
  });

  it("smooths what it wrote, runs the check over every file the smoothing left, and reports the records it mapped with what the smoothing did", async () => {
    const versionTwo = vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN);
    const pruneDebt = vi.fn<SmoothingCommands["pruneDebt"]>().mockResolvedValue({
      outcome: "ok",
      value: { changes: { write: [], remove: [] }, done: [PRUNED_DEBT] },
    });

    const proven = await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: recordsFolderPath(),
      },
      effects: {
        apply: vi
          .fn<ProofEffects["apply"]>()
          .mockReturnValueOnce(NOTHING_PATCHED)
          .mockReturnValueOnce(ALL_WRITTEN)
          .mockReturnValueOnce(VERSION_ONE_REMOVED),
        undo: vi.fn<ProofEffects["undo"]>(),
      },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo,
      },
      smoothing: { ...VERSION_ONE_REPOSITORY.smoothing, pruneDebt },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect({ proven, checkedOver: versionTwo.mock.calls }).toEqual({
      proven: {
        outcome: "ok",
        value: {
          ...CARRIED_OVER,
          smoothed: {
            removedCarried: [],
            recordedDebt: [],
            prunedDebt: [PRUNED_DEBT],
            projected: [],
          },
        },
      },
      checkedOver: [[{ written: WRITTEN_FILES }]],
    });
  });

  it("undoes what it wrote and gives the check's failing lines when version 2's check fails, removing nothing", async () => {
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce(ALL_WRITTEN);
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);

    const proven = await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: recordsFolderPath(),
      },
      effects: { apply, undo },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue({
          outcome: "ok",
          value: {
            report: { ...EMPTY_AFTER, findings: [NAMED_LOOP_FINDING] },
            failing: ["findings (1)", "the finding's line"],
          },
        }),
      },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect({ proven, applied: apply.mock.calls, undone: undo.mock.calls }).toEqual({
      proven: {
        outcome: "failed",
        error: {
          kind: "check-failed",
          failing: ["findings (1)", "the finding's line"],
          unrestored: [],
          removedByVersionOne: [],
        },
      },
      applied: [[PATCHING_NOTHING], [WRITING]],
      undone: [[ROLLING_BACK], [NOTHING_TO_RESTORE]],
    });
  });

  it("undoes what it wrote and stops at a smoothing step that fails, running no later step and no check", async () => {
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);
    const versionTwo = vi.fn<ProofRuns["versionTwo"]>();
    const recordDebt = vi.fn<SmoothingCommands["recordDebt"]>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "run-failed", failure: { kind: "config-absent", repo: "/repo" } },
    });

    const proven = await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: {
          read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
          exists: vi.fn<FileTextPort["exists"]>(),
        },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: recordsFolderPath(),
      },
      effects: {
        apply: vi
          .fn<ProofEffects["apply"]>()
          .mockReturnValueOnce(NOTHING_PATCHED)
          .mockReturnValueOnce(ALL_WRITTEN),
        undo,
      },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo,
      },
      smoothing: { ...VERSION_ONE_REPOSITORY.smoothing, recordDebt },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi
        .fn<VersionOneProjectionsOf>()
        .mockResolvedValue(FOUND_PROJECTIONS),
    });

    expect({ proven, checked: versionTwo.mock.calls, undone: undo.mock.calls }).toEqual({
      proven: {
        outcome: "failed",
        error: {
          kind: "smoothing-failed",
          step: "record-debt",
          failure: { kind: "run-failed", failure: { kind: "config-absent", repo: "/repo" } },
          unrestored: [],
          removedByVersionOne: [],
        },
      },
      checked: [],
      undone: [[ROLLING_BACK], [NOTHING_TO_RESTORE]],
    });
  });

  it("undoes what it wrote and names each directive, before the check's verdict, when version 2 reports a directive naming no check, removing nothing", async () => {
    const undo = vi.fn<ProofEffects["undo"]>().mockReturnValue([]);

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: recordsFolderPath(),
        },
        effects: {
          apply: vi
            .fn<ProofEffects["apply"]>()
            .mockReturnValueOnce(NOTHING_PATCHED)
            .mockReturnValueOnce(ALL_WRITTEN),
          undo,
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue({
            outcome: "ok",
            value: {
              report: {
                ...EMPTY_AFTER,
                findings: [NAMED_LOOP_FINDING],
                misnamed: [
                  {
                    kind: "names-no-check",
                    ruleId: "hone/no-such-check",
                    file: repoPathOf("src/a.ts"),
                    line: 3,
                    text: "the text",
                  },
                ],
              },
              failing: ["findings (1)"],
            },
          }),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: {
        kind: "directives-name-no-check",
        directives: [{ ruleId: "hone/no-such-check", file: "src/a.ts", line: 3 }],
        unrestored: [],
      },
    });
    expect(undo.mock.calls).toEqual([[ROLLING_BACK], [NOTHING_TO_RESTORE]]);
  });

  it.each([
    {
      name: "the first version 1 file",
      removal: {
        outcome: "stopped",
        settled: [],
        stopped: {
          effect: { kind: "remove-file", path: CARVE_OUT_FILE },
          outcome: "failed",
          detail: "EBUSY",
        },
      },
      failure: {
        kind: "unremovable",
        path: CARVE_OUT_FILE,
        detail: "EBUSY",
        removed: { files: [], folders: [] },
      },
      remaining: [CARVE_OUT_FILE, VERSION_ONE_PROJECTION, VERSION_ONE_SETTINGS],
    },
    {
      name: "a version 1 file part way through",
      removal: {
        outcome: "stopped",
        settled: [
          { effect: { kind: "remove-file", path: CARVE_OUT_FILE }, outcome: "applied" },
          {
            effect: { kind: "remove-directory-if-empty", path: VERSION_ONE_RECORDS_FOLDER },
            outcome: "applied",
          },
        ],
        stopped: {
          effect: { kind: "remove-file", path: VERSION_ONE_PROJECTION },
          outcome: "failed",
          detail: "the removal threw",
        },
      },
      failure: {
        kind: "unremovable",
        path: VERSION_ONE_PROJECTION,
        detail: "the removal threw",
        removed: { files: [CARVE_OUT_FILE], folders: [VERSION_ONE_RECORDS_FOLDER] },
      },
      remaining: [VERSION_ONE_PROJECTION, VERSION_ONE_SETTINGS],
    },
  ] as const)(
    "leaves the version 2 files in place, undoing nothing, and reports what it removed when it cannot remove $name",
    async ({ removal, failure, remaining }) => {
      const undo = vi.fn<ProofEffects["undo"]>();

      await expect(
        upgradeProof({
          ...VERSION_ONE_REPOSITORY,
          queries: {
            fileText: {
              read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
              exists: vi.fn<FileTextPort["exists"]>(),
            },
            entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
            path: recordsFolderPath(),
          },
          effects: {
            apply: vi
              .fn<ProofEffects["apply"]>()
              .mockReturnValueOnce(NOTHING_PATCHED)
              .mockReturnValueOnce(ALL_WRITTEN)
              .mockReturnValueOnce(removal),
            undo,
          },
          oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
          runs: {
            versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
            versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
          },
          projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
          versionOneProjectionsOf: vi
            .fn<VersionOneProjectionsOf>()
            .mockResolvedValue(FOUND_PROJECTIONS),
        }),
      ).resolves.toEqual({
        outcome: "failed",
        error: {
          kind: "removal-failed",
          failure,
          remaining,
          written: WRITTEN_FILES,
          replaced: ["eslint.config.mjs"],
        },
      });
      expect(undo).not.toHaveBeenCalled();
    },
  );

  it("upgrades a repository whose version 1 records sit in the single file at its root, removing no folder", async () => {
    const single = absoluteRootOf("/repo/discipline-exceptions.json");
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce(ALL_WRITTEN)
      .mockReturnValueOnce({
        outcome: "all-applied",
        settled: [
          { effect: { kind: "remove-file", path: single }, outcome: "applied" },
          { effect: { kind: "remove-file", path: VERSION_ONE_PROJECTION }, outcome: "applied" },
          { effect: { kind: "remove-file", path: VERSION_ONE_SETTINGS }, outcome: "applied" },
        ],
      });

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        versionOneFiles: SINGLE_FILE_LAYOUT,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: repositoryRootPath(),
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...CARRIED_OVER,
        removed: { files: [single, VERSION_ONE_PROJECTION, VERSION_ONE_SETTINGS], folders: [] },
      },
    });
    expect(apply.mock.calls[2]).toEqual([
      {
        effects: [
          { kind: "remove-file", path: single },
          { kind: "remove-file", path: VERSION_ONE_PROJECTION },
          { kind: "remove-file", path: VERSION_ONE_SETTINGS },
        ],
      },
    ]);
  });

  it("refuses, before writing anything, a version 1 records file outside its records folder", async () => {
    const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED);

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        versionOneFiles: {
          ...VERSION_ONE_REPOSITORY.versionOneFiles,
          recordsFiles: [repoPathOf("tools/x.json")],
        },
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: outsideRecordsFolderPath(),
        },
        effects: { apply, undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]) },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>(),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "removal-refused",
        failure: {
          kind: "records-file-outside-root",
          path: "/repo/tools/x.json",
          root: "/repo/discipline-exceptions",
        },
        removedByVersionOne: [],
      },
    });
    expect(apply.mock.calls).toEqual([[PATCHING_NOTHING]]);
  });

  it("undoes what it wrote, and names what it could not restore, when the version 2 run rejects", async () => {
    const undo = vi
      .fn<ProofEffects["undo"]>()
      .mockReturnValueOnce([{ written: "file-created", path: DEBT_PATH, detail: "EBUSY" }])
      .mockReturnValueOnce([]);

    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: recordsFolderPath(),
        },
        effects: {
          apply: vi
            .fn<ProofEffects["apply"]>()
            .mockReturnValueOnce(NOTHING_PATCHED)
            .mockReturnValueOnce(ALL_WRITTEN),
          undo,
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi
            .fn<ProofRuns["versionTwo"]>()
            .mockRejectedValue(new Error("the runner threw")),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi
          .fn<VersionOneProjectionsOf>()
          .mockResolvedValue(FOUND_PROJECTIONS),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "version-two-run-failed",
        failure: { kind: "run-failed", detail: "the runner threw" },
        unrestored: [{ written: "file-created", path: DEBT_PATH, detail: "EBUSY" }],
        removedByVersionOne: [],
      },
    });
    expect(undo.mock.calls).toEqual([[ROLLING_BACK], [NOTHING_TO_RESTORE]]);
  });

  it.each([
    {
      name: "the team config is refused and version 1 changed nothing",
      reading: {
        written: [],
        removed: [],
        outcome: {
          outcome: "failed",
          error: { kind: "team-config-refused", refusal: NO_IMPORTER },
        },
      },
      error: {
        kind: "plan-refused",
        refusal: { kind: "team-config-refused", refusal: NO_IMPORTER },
        removedByVersionOne: [],
      },
    },
    {
      name: "the team config is refused after version 1 removed a slice",
      reading: {
        written: [],
        removed: [ORPHAN],
        outcome: {
          outcome: "failed",
          error: { kind: "team-config-refused", refusal: NO_IMPORTER },
        },
      },
      error: {
        kind: "plan-refused",
        refusal: { kind: "team-config-refused", refusal: NO_IMPORTER },
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    },
    {
      name: "version 1 left a slice in place",
      reading: {
        written: [],
        removed: [ORPHAN],
        outcome: {
          outcome: "failed",
          error: {
            kind: "slice-left-in-place",
            files: [repoPathOf("stale/disciplines.eslint.mjs")],
          },
        },
      },
      error: {
        kind: "plan-refused",
        refusal: { kind: "slice-left-in-place", files: ["stale/disciplines.eslint.mjs"] },
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    },
    {
      name: "version 1's project fails",
      reading: {
        written: [],
        removed: [],
        outcome: { outcome: "failed", error: { kind: "project-failed", detail: "disk full" } },
      },
      error: { kind: "version-one-project-failed", detail: "disk full", removedByVersionOne: [] },
    },
  ] as const)(
    "refuses, writing nothing and naming any slice version 1 removed, when $name",
    async ({ reading, error }) => {
      const apply = vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED);

      await expect(
        upgradeProof({
          ...VERSION_ONE_REPOSITORY,
          queries: {
            fileText: {
              read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
              exists: vi.fn<FileTextPort["exists"]>(),
            },
            entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
            path: sliceFirstPath(),
          },
          effects: { apply, undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]) },
          oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
          runs: {
            versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
            versionTwo: vi.fn<ProofRuns["versionTwo"]>(),
          },
          projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
          versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(reading),
        }),
      ).resolves.toEqual({ outcome: "failed", error });
      expect(apply.mock.calls).toEqual([[PATCHING_NOTHING]]);
    },
  );

  it("names the slice version 1 removed when that slice cannot be placed in the repository", async () => {
    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: {
            join: vi.fn<PathPort["join"]>().mockReturnValue("not-absolute"),
            relative: vi.fn<PathPort["relative"]>(),
            directoryOf: vi.fn<PathPort["directoryOf"]>(),
          },
        },
        effects: {
          apply: vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED),
          undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]),
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>(),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(SLICE_REMOVED),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "unplaceable-path",
        file: "old/disciplines.eslint.mjs",
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    });
  });

  it("refuses a version 2 projection no version 1 projection stands behind, naming the slice version 1 removed to restore", async () => {
    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: sliceFirstPath(),
        },
        effects: {
          apply: vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED),
          undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]),
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>(),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue({
          outcome: "ok",
          value: {
            entries: [
              { ...ROOT_PROJECTION_FILE, kind: "write" },
              { ...SLICE_PROJECTION_FILE, kind: "write" },
            ],
            projections: [ROOT_PROJECTION_FILE, SLICE_PROJECTION_FILE],
          },
        }),
        versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(SLICE_REMOVED),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-two-projection-unpaired",
            file: "packages/a/hone.eslint.mjs",
            folder: "packages/a",
          },
        },
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    });
  });

  it("names the slice version 1 removed to restore when a file it would write already exists", async () => {
    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfExistingFirstFile() },
          path: sliceFirstPath(),
        },
        effects: {
          apply: vi.fn<ProofEffects["apply"]>().mockReturnValueOnce(NOTHING_PATCHED),
          undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]),
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>(),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(SLICE_REMOVED),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "write-refused",
        refusal: { failure: { kind: "path-already-exists", path: SETTINGS_PATH }, unrestored: [] },
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    });
  });

  it("names the slice version 1 removed to restore, with what it rolled back, when the version 2 run fails", async () => {
    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: sliceFirstPath(),
        },
        effects: {
          apply: vi
            .fn<ProofEffects["apply"]>()
            .mockReturnValueOnce(NOTHING_PATCHED)
            .mockReturnValueOnce(ALL_WRITTEN),
          undo: vi.fn<ProofEffects["undo"]>().mockReturnValue([]),
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue({
            outcome: "failed",
            error: { kind: "run-failed", detail: "config unreadable" },
          }),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(SLICE_REMOVED),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "version-two-run-failed",
        failure: { kind: "run-failed", detail: "config unreadable" },
        unrestored: [],
        removedByVersionOne: ["old/disciplines.eslint.mjs"],
      },
    });
  });

  it("lists the slice version 1 removed among the version 1 files removed, first", async () => {
    await expect(
      upgradeProof({
        ...VERSION_ONE_REPOSITORY,
        queries: {
          fileText: {
            read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ),
            exists: vi.fn<FileTextPort["exists"]>(),
          },
          entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
          path: sliceFirstPath(),
        },
        effects: {
          apply: vi
            .fn<ProofEffects["apply"]>()
            .mockReturnValueOnce(NOTHING_PATCHED)
            .mockReturnValueOnce(ALL_WRITTEN)
            .mockReturnValueOnce(VERSION_ONE_REMOVED),
          undo: vi.fn<ProofEffects["undo"]>(),
        },
        oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
        runs: {
          versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
          versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
        },
        projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
        versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(SLICE_REMOVED),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...CARRIED_OVER,
        removed: {
          files: [
            "/repo/old/disciplines.eslint.mjs",
            CARVE_OUT_FILE,
            VERSION_ONE_PROJECTION,
            VERSION_ONE_SETTINGS,
          ],
          folders: [VERSION_ONE_RECORDS_FOLDER],
        },
      },
    });
  });

  it("removes the declaration file beside a slice projection version 1's own project removed", async () => {
    const exists = vi
      .fn<FileTextPort["exists"]>()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("present");
    const sliceDeclaration = absoluteRootOf("/repo/old/disciplines.eslint.d.mts");
    const apply = vi
      .fn<ProofEffects["apply"]>()
      .mockReturnValueOnce(NOTHING_PATCHED)
      .mockReturnValueOnce(ALL_WRITTEN)
      .mockReturnValueOnce(VERSION_ONE_REMOVED);

    await upgradeProof({
      ...VERSION_ONE_REPOSITORY,
      queries: {
        fileText: { read: vi.fn<FileTextPort["read"]>().mockReturnValue(CONFIG_READ), exists },
        entryKind: { kindOf: kindsOfEveryPlannedFileNew() },
        path: sliceFirstPath(),
      },
      effects: { apply, undo: vi.fn<ProofEffects["undo"]>() },
      oracle: { answer: vi.fn<RecordAnswerOracle["answer"]>().mockResolvedValue(ANSWERED) },
      runs: {
        versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue(VERSION_ONE_PASSING),
        versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue(AFTER_RUN),
      },
      projectionFilesOf: vi.fn<ProjectionFilesOf>().mockResolvedValue(ROOT_PROJECTION_FILES),
      versionOneProjectionsOf: vi.fn<VersionOneProjectionsOf>().mockResolvedValue(SLICE_REMOVED),
    });

    expect([exists.mock.calls, apply.mock.calls[2]]).toEqual([
      [[{ path: "/repo/disciplines.eslint.d.mts" }], [{ path: sliceDeclaration }]],
      [
        {
          effects: [
            { kind: "remove-file", path: CARVE_OUT_FILE },
            { kind: "remove-directory-if-empty", path: VERSION_ONE_RECORDS_FOLDER },
            { kind: "remove-file", path: VERSION_ONE_PROJECTION },
            { kind: "remove-file", path: sliceDeclaration },
            { kind: "remove-file", path: VERSION_ONE_SETTINGS },
          ],
        },
      ],
    ]);
  });
});
