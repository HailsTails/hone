import { describe, expect, it, vi } from "vitest";
import type { LegacyWhyChain, VersionOneWhyChain } from "../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { ExceptionEntryParser } from "../../ports/records/exception-entries.ts";
import type { PlacedEntry, StructuralExceptionEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionReading, ExceptionRecord, InvalidRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { LoadedRunner, RunnerCall } from "../../ports/engine/runner-module.ts";
import type { EnginePort } from "../../ports/engine/engine-port.ts";
import type { MechanismRun } from "../../../domain/runner/mechanism-run.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { Hit, MeasuredPair } from "../../../domain/runner/runner-result-types.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";
import type { Assessment } from "../../../domain/settings/assessment.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { editionSchema, FIRST_EDITION } from "../../../infrastructure/content-files/edition.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { type CheckRequest, runCheck, runReachedCheck } from "./run-check.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const LEGACY_WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "tools/why-chain-check.ts:9",
};

const LEGACY_WHY_CHAIN: LegacyWhyChain = {
  whys: [LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY],
  rootCause: "the audit's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const TEAM_ROOT = absolutePathSchema.parse("/repo/rules/team");
const ASSESSMENT_PATH = "/repo/disciplines.assessment.md";
const RULE_PAGE_PATH = "/install/rules/CD-14/README.md";

const AUDIT = "audit" as const;
const LINT = "eslint" as const;
const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");
const ABSTRACT_SYNTAX = clauseAddressSchema.parse("CD-14#abstract-syntax");
const NO_FOR_OF = clauseAddressSchema.parse("CD-15#no-for-of");
const SECOND_EDITION = editionSchema.parse("2");
const TEAM_CLASS_SYNTAX = clauseAddressSchema.parse("team/CD-14#class-syntax");

const CLASS_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };
const ABSTRACT_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "abstract-syntax" };

const DEFAULT_ASSESSMENT: Assessment = { forfeiture: "this-run" };

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): CheckRequest["fileText"] => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
});

const INSTALL: Readonly<Record<string, FakeFile>> = {
  "/repo/README.md": presentFile({ text: "" }),
  "/repo/package.json": presentFile({ text: "" }),
  "/repo/src/a.ts": presentFile({ text: "" }),
  "/repo/src/b.tsx": presentFile({ text: "" }),
  "/repo/src/c.mts": presentFile({ text: "" }),
  "/repo/src/d.cts": presentFile({ text: "" }),
  "/repo/src/e.js": presentFile({ text: "" }),
  "/repo/src/f.json": presentFile({ text: "" }),
  "/repo/src/factory.ts": presentFile({ text: "" }),
  "/repo/src/gone.ts": ABSENT_FILE,
  "/repo/vendored/kept.ts": presentFile({ text: "" }),
  [ASSESSMENT_PATH]: ABSENT_FILE,
  [RULE_PAGE_PATH]: presentFile({ text: "# CD-14\n" }),
};

const pathJoining = (join: PathPort["join"]): PathPort => ({
  join,
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

const joiningTrackedPaths = () =>
  vi
    .fn<PathPort["join"]>()
    .mockReturnValueOnce("/repo/README.md")
    .mockReturnValueOnce("/repo/package.json")
    .mockReturnValueOnce("/repo/src/a.ts")
    .mockReturnValueOnce("/repo/src/b.tsx")
    .mockReturnValueOnce("/repo/src/c.mts")
    .mockReturnValueOnce("/repo/src/d.cts")
    .mockReturnValueOnce("/repo/src/e.js")
    .mockReturnValueOnce("/repo/src/f.json");

const joiningReadFirstPaths = () =>
  joiningTrackedPaths()
    .mockReturnValueOnce("/repo/disciplines.assessment.md")
    .mockReturnValueOnce("/install/ADOPTING.md")
    .mockReturnValueOnce("/install/rules/CD-14/README.md");

const SHOWN_PATHS: Readonly<Record<string, string>> = {
  "/install/ADOPTING.md": "../install/ADOPTING.md",
  "/install/rules/CD-14/README.md": "../install/rules/CD-14/README.md",
};

const shownPathOf: ShownPathOf = ({ target }) => SHOWN_PATHS[target];

const classSyntaxBinding = { mechanism: AUDIT, clause: {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
  settings: { module: "class-syntax.ts" },
  clauseSettings: {},
  edition: FIRST_EDITION,
} } as const;

const abstractSyntaxBinding = { mechanism: AUDIT, clause: {
  address: ABSTRACT_SYNTAX,
  anchor: { kind: "keyword", keyword: "abstract" },
  pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
  settings: { module: "abstract-syntax.ts" },
  clauseSettings: {},
  edition: FIRST_EDITION,
} } as const;

const SELECTED_CLASS_SYNTAX = { address: CLASS_SYNTAX, mechanism: AUDIT, exceptions: "allowed" } as const;

const SELECTED_ABSTRACT_SYNTAX = { address: ABSTRACT_SYNTAX, mechanism: AUDIT, exceptions: "allowed" } as const;

const CLASS_SYNTAX_ROOT = { clause: CLASS_SYNTAX, ruleSetRoot: INSTALL_ROOT };

const ABSTRACT_SYNTAX_ROOT = { clause: ABSTRACT_SYNTAX, ruleSetRoot: INSTALL_ROOT };

const SELECTION_READING: SelectionReading = {
  selection: { selected: [SELECTED_CLASS_SYNTAX], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [classSyntaxBinding],
  clauseRoots: [CLASS_SYNTAX_ROOT],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
};

const TWO_CLAUSE_READING: SelectionReading = {
  ...SELECTION_READING,
  selection: { ...SELECTION_READING.selection, selected: [SELECTED_CLASS_SYNTAX, SELECTED_ABSTRACT_SYNTAX] },
  bindings: [classSyntaxBinding, abstractSyntaxBinding],
  clauseRoots: [CLASS_SYNTAX_ROOT, ABSTRACT_SYNTAX_ROOT],
};

const ABSTRACT_SYNTAX_ONLY_READING: SelectionReading = {
  ...SELECTION_READING,
  selection: { ...SELECTION_READING.selection, selected: [SELECTED_ABSTRACT_SYNTAX] },
  bindings: [abstractSyntaxBinding],
  clauseRoots: [ABSTRACT_SYNTAX_ROOT],
};

const selectionRepositoryReading = (reading: SelectionReading): SelectionRepository => ({
  read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: reading }),
});

const CARVE_OUT_ON_GONE: StructuralExceptionEntry = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/gone.ts",
  reason: "legacy class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const FIXTURE_SOURCE = "fictional unit fixture core/check/run-check.test.ts; not historical authorisation";

const AUTHORISED_FACTORY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
};

const firstInSingleFile = (entry: StructuralExceptionEntry): PlacedEntry => ({
  place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 },
  entry,
});

const secondInSingleFile = (entry: StructuralExceptionEntry): PlacedEntry => ({
  place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 1 },
  entry,
});

const exceptionRepositoryHolding = (request: { readonly working: readonly PlacedEntry[] }): Pick<ExceptionRepository, "read" | "readAt"> => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: request.working }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
});

const exceptionRepositoryAtBase = (request: {
  readonly working: readonly PlacedEntry[];
  readonly base: ReturnType<ExceptionRepository["readAt"]>;
}): Pick<ExceptionRepository, "read" | "readAt"> => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: request.working }),
  readAt: vi.fn<ExceptionRepository["readAt"]>().mockReturnValue(request.base),
});

const NO_RECORDS: Pick<ExceptionRepository, "read" | "readAt"> = {
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
};

const parserReading = (request: { readonly reading: ExceptionReading; readonly imported: "present" | "absent" }): ExceptionEntryParser => ({
  parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>().mockReturnValue(request.reading),
  importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>().mockReturnValue(request.imported),
  importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>().mockReturnValue([]),
});

const parserHolding = (records: readonly ExceptionRecord[]): ExceptionEntryParser =>
  parserReading({ reading: { records, invalid: [] }, imported: "absent" });

const parserRefusing = (invalid: readonly InvalidRecord[]): ExceptionEntryParser =>
  parserReading({ reading: { records: [], invalid }, imported: "absent" });

const TRACKED_PATHS: readonly RepoPath[] = [
  repoPathSchema.parse("README.md"),
  repoPathSchema.parse("package.json"),
  repoPathSchema.parse("src/a.ts"),
  repoPathSchema.parse("src/b.tsx"),
  repoPathSchema.parse("src/c.mts"),
  repoPathSchema.parse("src/d.cts"),
  repoPathSchema.parse("src/e.js"),
  repoPathSchema.parse("src/f.json"),
];

const CLASS_SYNTAX_READING_FIRST = {
  kind: "clause",
  clause: CLASS_SYNTAX_OBJECT,
  assessmentSection: "unread",
  rulePage: { path: "../install/rules/CD-14/README.md", presence: "present" },
};

const ASSESSMENT_NOT_WRITTEN = { kind: "assessment-file", state: "not-written", guide: "../install/ADOPTING.md" };

const HIT_IN_A: Hit = {
  clause: CLASS_SYNTAX,
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const HIT_FROM_AN_IMPORT: Hit = { ...HIT_IN_A, snippet: "import fp from \"lodash/fp\";", importSpecifier: "lodash/fp" };

const EMPTY_REPORT = {
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

const STANDALONE_RUNNER: LoadedRunner = {
  exceptionPath: "standalone",
  run: vi.fn<RunnerCall>(),
  conform: vi.fn<RunnerCall>(),
};

const EMBEDDED_RUNNER: LoadedRunner = {
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<RunnerCall>(),
  conform: vi.fn<RunnerCall>(),
  project: vi.fn<RunnerCall>(),
};

const UNUSED_MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const engineAnswering = (request: { readonly runner: LoadedRunner; readonly run: Result<MechanismRun, RunnerFailure> }): EnginePort => ({
  load: vi.fn<EnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: { mechanism: AUDIT, runner: request.runner, checksRunner: undefined } }),
  run: {
    checks: vi.fn<EnginePort["run"]["checks"]>(),
    withRecords: vi.fn<EnginePort["run"]["withRecords"]>().mockResolvedValue(request.run),
  },
  project: {
    checks: vi.fn<EnginePort["project"]["checks"]>(),
    withRecords: vi.fn<EnginePort["project"]["withRecords"]>(),
  },
  conform: vi.fn<EnginePort["conform"]>(),
});

type StandaloneReport = Pick<MechanismRun, "hits" | "nativeExceptions" | "measured">;

const standaloneEngine = (report: StandaloneReport): EnginePort =>
  engineAnswering({
    runner: STANDALONE_RUNNER,
    run: {
      outcome: "ok",
      value: { mechanism: AUDIT, coverableKinds: ["inline-disable"], projection: "none", slices: [], unprojectedFolders: [], ...report },
    },
  });

type EmbeddedReport = Pick<MechanismRun, "hits" | "nativeExceptions" | "projection"> & Partial<Pick<MechanismRun, "slices" | "measured">>;

const embeddedEngine = (report: EmbeddedReport): EnginePort =>
  engineAnswering({
    runner: EMBEDDED_RUNNER,
    run: {
      outcome: "ok",
      value: { mechanism: AUDIT, coverableKinds: ["config-override"], slices: [], unprojectedFolders: [], measured: [], ...report },
    },
  });

const engineFailing = (failure: RunnerFailure): EnginePort => engineAnswering({ runner: STANDALONE_RUNNER, run: { outcome: "failed", error: failure } });

const CLEAN_ENGINE_REPORT: StandaloneReport = { hits: [], nativeExceptions: [], measured: [] };

const gitReporting = (request: { readonly trackedPaths: Result<readonly RepoPath[], GitFailure> }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(request.trackedPaths),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>().mockReturnValue({ outcome: "ok", value: new Map() }),
});

const gitMeasuring = (request: {
  readonly trackedPaths: Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: Result<readonly RepoPath[], GitFailure>;
}): GitPort => ({
  ...gitReporting(request),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue(request.changedSince),
});

const TRACKED_GIT = gitReporting({ trackedPaths: { outcome: "ok", value: TRACKED_PATHS } });

const FACTORY_ONLY_GIT = gitReporting({ trackedPaths: { outcome: "ok", value: [repoPathSchema.parse("src/factory.ts")] } });

const checkRequest = (overrides: Partial<CheckRequest>): CheckRequest => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  baseRevision: "main",
  assessment: DEFAULT_ASSESSMENT,
  fileText: fileTextOver(INSTALL),
  engine: standaloneEngine(CLEAN_ENGINE_REPORT),
  modules: UNUSED_MODULES,
  path: pathJoining(joiningTrackedPaths()),
  git: TRACKED_GIT,
  selectionRepository: selectionRepositoryReading(SELECTION_READING),
  exceptionRepository: NO_RECORDS,
  exceptionEntryParser: parserHolding([]),
  shownPathOf,
  ...overrides,
});

const AUTHORISED_FACTORY_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
};

const carveOutRecordOn = (file: string): ExceptionRecord => ({
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse(file),
  reason: "legacy class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
});

const CARVE_OUT_RECORD_ON_GONE = carveOutRecordOn("src/gone.ts");

const FIRST_PLACE = { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 } as const;

const SECOND_PLACE = { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 1 } as const;

describe("runCheck reports", () => {
  it("is a pass report when the runner flags nothing", async () => {
    await expect(runCheck(checkRequest({}))).resolves.toEqual({ outcome: "ok", value: EMPTY_REPORT });
  });

  it("reports the runner's hit as a finding attributed to its mechanism", async () => {
    await expect(
      runCheck(checkRequest({ path: pathJoining(joiningReadFirstPaths()), engine: standaloneEngine({ hits: [HIT_IN_A], nativeExceptions: [], measured: [] }) })),
    ).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, findings: [{ ...HIT_IN_A, mechanism: "audit" }], readFirst: [ASSESSMENT_NOT_WRITTEN, CLASS_SYNTAX_READING_FIRST] },
    });
  });

  it("keeps on a finding the import specifier its runner's hit names, as data and nothing more", async () => {
    await expect(
      runCheck(checkRequest({ path: pathJoining(joiningReadFirstPaths()), engine: standaloneEngine({ hits: [HIT_FROM_AN_IMPORT], nativeExceptions: [], measured: [] }) })),
    ).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, findings: [{ ...HIT_FROM_AN_IMPORT, mechanism: "audit" }], readFirst: [ASSESSMENT_NOT_WRITTEN, CLASS_SYNTAX_READING_FIRST] },
    });
  });

  it("exempts a finding an authorised location names and credits the location", async () => {
    await expect(
      runCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/src/factory.ts"),
          ),
          exceptionRepository: exceptionRepositoryAtBase({ working: [firstInSingleFile(AUTHORISED_FACTORY)], base: { outcome: "ok", value: [AUTHORISED_FACTORY] } }),
          exceptionEntryParser: parserReading({ reading: { records: [AUTHORISED_FACTORY_RECORD], invalid: [] }, imported: "present" }),
          engine: standaloneEngine({ hits: [{ ...HIT_IN_A, file: repoPathSchema.parse("src/factory.ts") }], nativeExceptions: [], measured: [] }),
          git: FACTORY_ONLY_GIT,
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        exempted: [{ finding: { ...HIT_IN_A, file: "src/factory.ts", mechanism: "audit" }, by: [AUTHORISED_FACTORY_RECORD] }],
      },
    });
  });

  it("lists an invalid exception record without failing the load", async () => {
    await expect(
      runCheck(
        checkRequest({
          exceptionRepository: exceptionRepositoryHolding({
            working: [firstInSingleFile({ kind: "authorised-location", clause: "CD-15#no-for-of", file: "src/a.ts", reason: "loop" })],
          }),
          exceptionEntryParser: parserRefusing([{ place: FIRST_PLACE, problem: { kind: "clause-not-selected", clause: NO_FOR_OF } }]),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { invalidRecords: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "clause-not-selected" } }] },
    });
  });

  it("reports each selected clause's edition and the latest beside it, as the selection reads them", async () => {
    await expect(
      runCheck(
        checkRequest({
          selectionRepository: selectionRepositoryReading({
            ...SELECTION_READING,
            selection: { ...SELECTION_READING.selection, editions: [{ address: CLASS_SYNTAX, mechanism: AUDIT, edition: FIRST_EDITION, latest: SECOND_EDITION }] },
          }),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, editions: [{ address: CLASS_SYNTAX_OBJECT, mechanism: "audit", edition: "1", latest: "2" }] },
    });
  });

  it("lists the uncovered mechanical clauses of an adopted discipline", async () => {
    await expect(
      runCheck(
        checkRequest({
          selectionRepository: selectionRepositoryReading({
            ...SELECTION_READING,
            selection: { ...SELECTION_READING.selection, uncovered: [ABSTRACT_SYNTAX] },
          }),
        }),
      ),
    ).resolves.toEqual({ outcome: "ok", value: { ...EMPTY_REPORT, uncovered: [ABSTRACT_SYNTAX_OBJECT] } });
  });
});

describe("runCheck runner dispatch", () => {
  it("loads the engine once for the mechanism, from the install root", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    const path = pathJoining(joiningTrackedPaths());
    const report = await runCheck(checkRequest({ engine, path, selectionRepository: selectionRepositoryReading(TWO_CLAUSE_READING) }));
    expect(report).toEqual({ outcome: "ok", value: EMPTY_REPORT });
    expect(engine.load).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ installRoot: "/install", moduleExtension: ".ts", modules: UNUSED_MODULES, path, mechanism: "audit" }),
    );
  });

  it("runs the mechanism once with every selected clause, the TypeScript files and the tracked paths", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    await runCheck(checkRequest({ engine, selectionRepository: selectionRepositoryReading(TWO_CLAUSE_READING) }));
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith({
      runner: STANDALONE_RUNNER,
      mechanism: "audit",
      run: {
        repoRoot: "/repo",
        installRoot: "/install",
        files: ["src/a.ts", "src/b.tsx", "src/c.mts", "src/d.cts"],
        trackedPaths: TRACKED_PATHS,
        clauses: [
          {
            address: CLASS_SYNTAX_OBJECT,
            anchor: { kind: "keyword", keyword: "class" },
            pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
            settings: { module: "class-syntax.ts" },
            clauseSettings: {},
            edition: "1",
          },
          {
            address: ABSTRACT_SYNTAX_OBJECT,
            anchor: { kind: "keyword", keyword: "abstract" },
            pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
            settings: { module: "abstract-syntax.ts" },
            clauseSettings: {},
            edition: "1",
          },
        ],
      },
      declaredConfigRoots: [],
      records: [],
    });
  });

  it("reads the selection and the exception records once each", async () => {
    const selectionRepository = selectionRepositoryReading(SELECTION_READING);
    const exceptionRepository = exceptionRepositoryHolding({ working: [] });
    await runCheck(checkRequest({ selectionRepository, exceptionRepository }));
    expect(selectionRepository.read).toHaveBeenCalledExactlyOnceWith({});
    expect(exceptionRepository.read).toHaveBeenCalledExactlyOnceWith();
  });

  it("drops a tracked path absent from the working tree from both the files and the tracked paths it runs on", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    await runCheck(
      checkRequest({
        path: pathJoining(
          vi.fn<PathPort["join"]>()
            .mockReturnValueOnce("/repo/README.md")
            .mockReturnValueOnce("/repo/src/a.ts")
            .mockReturnValueOnce("/repo/src/gone.ts"),
        ),
        engine,
        git: gitReporting({
          trackedPaths: { outcome: "ok", value: [repoPathSchema.parse("README.md"), repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("src/gone.ts")] },
        }),
      }),
    );
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ run: expect.objectContaining({ files: ["src/a.ts"], trackedPaths: ["README.md", "src/a.ts"] }) }),
    );
  });

  it("drops every tracked path the selection excludes, as a folder or as an exact file, from the files and the tracked paths it runs on", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    await runCheck(
      checkRequest({
        path: pathJoining(
          vi.fn<PathPort["join"]>()
            .mockReturnValueOnce("/repo/src/a.ts")
            .mockReturnValueOnce("/repo/vendored/kept.ts"),
        ),
        selectionRepository: selectionRepositoryReading({
          ...SELECTION_READING,
          excluded: [repoPathSchema.parse("vendor"), repoPathSchema.parse("src/generated.ts")],
        }),
        engine,
        git: gitReporting({
          trackedPaths: {
            outcome: "ok",
            value: [
              repoPathSchema.parse("src/a.ts"),
              repoPathSchema.parse("src/generated.ts"),
              repoPathSchema.parse("vendor/lib.ts"),
              repoPathSchema.parse("vendored/kept.ts"),
            ],
          },
        }),
      }),
    );
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ run: expect.objectContaining({ files: ["src/a.ts", "vendored/kept.ts"], trackedPaths: ["src/a.ts", "vendored/kept.ts"] }) }),
    );
  });

  it("points at the paid debt it names, counting a stale file carve-out", async () => {
    await expect(
      runCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/gone.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(CARVE_OUT_ON_GONE)] }),
          exceptionEntryParser: parserHolding([CARVE_OUT_RECORD_ON_GONE]),
          git: gitMeasuring({ trackedPaths: { outcome: "ok", value: TRACKED_PATHS }, changedSince: { outcome: "ok", value: [] } }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { readFirst: [{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }] } });
  });

  it("still forfeits a carve-out on a tracked path absent from the working tree that the change set touched", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    const checked = await runCheck(
      checkRequest({
        path: pathJoining(
          vi.fn<PathPort["join"]>()
            .mockReturnValueOnce("/repo/src/a.ts")
            .mockReturnValueOnce("/repo/src/gone.ts")
            .mockReturnValueOnce("/repo/src/gone.ts"),
        ),
        exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(CARVE_OUT_ON_GONE)] }),
        exceptionEntryParser: parserHolding([CARVE_OUT_RECORD_ON_GONE]),
        engine,
        git: gitMeasuring({
          trackedPaths: { outcome: "ok", value: [repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("src/gone.ts")] },
          changedSince: { outcome: "ok", value: [repoPathSchema.parse("src/gone.ts")] },
        }),
      }),
    );
    expect(checked).toMatchObject({ outcome: "ok", value: { forfeited: [{ kind: "file-carve-out", file: "src/gone.ts" }] } });
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ run: expect.objectContaining({ files: ["src/a.ts"], trackedPaths: ["src/a.ts"] }) }),
    );
  });

  it("probes only the tracked files, the assessment file and the rule page of the clause it reports, and reads no file", async () => {
    const fileText = fileTextOver(INSTALL);
    const reads = vi.spyOn(fileText, "read");
    const probes = vi.spyOn(fileText, "exists");
    await runCheck(checkRequest({ path: pathJoining(joiningReadFirstPaths()), fileText, engine: hitEngine() }));
    expect(probes.mock.calls).toEqual([
      [{ path: "/repo/README.md" }],
      [{ path: "/repo/package.json" }],
      [{ path: "/repo/src/a.ts" }],
      [{ path: "/repo/src/b.tsx" }],
      [{ path: "/repo/src/c.mts" }],
      [{ path: "/repo/src/d.cts" }],
      [{ path: "/repo/src/e.js" }],
      [{ path: "/repo/src/f.json" }],
      [{ path: ASSESSMENT_PATH }],
      [{ path: RULE_PAGE_PATH }],
    ]);
    expect(reads).not.toHaveBeenCalled();
  });

  it("roots a named rule set's piece under the consumer's rule-set directory and still loads the install's engine", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    const teamClause = { ...classSyntaxBinding.clause, address: TEAM_CLASS_SYNTAX, pieceRoot: "/repo/rules/team/mechanisms/audit/CD-14" };
    const report = await runCheck(
      checkRequest({
        engine,
        selectionRepository: selectionRepositoryReading({
          ...SELECTION_READING,
          selection: { ...SELECTION_READING.selection, selected: [{ ...SELECTED_CLASS_SYNTAX, address: TEAM_CLASS_SYNTAX }] },
          bindings: [{ mechanism: AUDIT, clause: teamClause }],
          clauseRoots: [{ clause: TEAM_CLASS_SYNTAX, ruleSetRoot: TEAM_ROOT }],
        }),
      }),
    );
    expect(report).toEqual({ outcome: "ok", value: EMPTY_REPORT });
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        run: expect.objectContaining({
          clauses: [
            {
              address: { ruleSet: { name: "team" }, discipline: "CD-14", clause: "class-syntax" },
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/repo/rules/team/mechanisms/audit/CD-14",
              settings: { module: "class-syntax.ts" },
              clauseSettings: {},
              edition: "1",
            },
          ],
        }),
      }),
    );
    expect(engine.load).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ installRoot: "/install", mechanism: "audit" }));
  });
});

describe("runCheck load failures", () => {
  it("passes on the selection's load failure", async () => {
    const failure: Result<never, LoadFailure> = {
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" },
    };
    await expect(
      runCheck(checkRequest({ selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue(failure) } })),
    ).resolves.toEqual(failure);
  });

  it("passes on the exception records' load failure", async () => {
    const failure: Result<never, LoadFailure> = {
      outcome: "failed",
      error: { kind: "file-malformed", path: "/repo/discipline-exceptions.json", detail: "unknown exception kind" },
    };
    await expect(
      runCheck(
        checkRequest({
          exceptionRepository: { read: vi.fn<ExceptionRepository["read"]>().mockReturnValue(failure), readAt: vi.fn<ExceptionRepository["readAt"]>() },
        }),
      ),
    ).resolves.toEqual(failure);
  });

  it("is runner-invalid with the engine's detail when the mechanism's runner fails to load", async () => {
    await expect(
      runCheck(
        checkRequest({
          engine: {
            ...standaloneEngine(CLEAN_ENGINE_REPORT),
            load: vi.fn<EnginePort["load"]>().mockResolvedValue({
              outcome: "failed",
              error: { kind: "runner-invalid", mechanism: AUDIT, detail: "Cannot find package 'typescript'" },
            }),
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "audit", detail: "Cannot find package 'typescript'" },
    });
  });

  it("is git-failed when git cannot list the tracked paths", async () => {
    await expect(
      runCheck(
        checkRequest({
          git: gitReporting({
            trackedPaths: { outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a git repository" } },
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "git-failed" } });
  });

  it("is runner-failed carrying the runner's own failure", async () => {
    await expect(
      runCheck(checkRequest({ engine: engineFailing({ kind: "file-unparseable", file: repoPathSchema.parse("src/a.ts"), detail: "unexpected token" }) })),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "audit",
        failure: { kind: "file-unparseable", file: "src/a.ts", detail: "unexpected token" },
      },
    });
  });

  it("is runner-failed with runner-invalid-output when the engine finds the runner's value is not a result", async () => {
    await expect(
      runCheck(checkRequest({ engine: engineFailing({ kind: "runner-invalid-output", detail: "✖ Invalid input" }) })),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: "audit", failure: { kind: "runner-invalid-output" } },
    });
  });
});

const WALKER_LOCATION: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/walker.ts",
  reason: "audit location",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
};

const LINT_LOCATION: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#abstract-syntax",
  file: "src/lint.ts",
  reason: "lint location",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
};

const TWO_MECHANISM_READING: SelectionReading = {
  ...SELECTION_READING,
  selection: { ...SELECTION_READING.selection, selected: [SELECTED_CLASS_SYNTAX, { ...SELECTED_ABSTRACT_SYNTAX, mechanism: LINT }] },
  bindings: [
    classSyntaxBinding,
    { mechanism: LINT, clause: { ...abstractSyntaxBinding.clause, pieceRoot: "/install/src/infrastructure/engines/lint/CD-14" } },
  ],
  clauseRoots: [CLASS_SYNTAX_ROOT, ABSTRACT_SYNTAX_ROOT],
};

const WALKER_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/walker.ts"),
  reason: "audit location",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
};

const LINT_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: ABSTRACT_SYNTAX,
  mechanism: LINT,
  file: repoPathSchema.parse("src/lint.ts"),
  reason: "lint location",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
};

const embeddedCheck = (report: EmbeddedReport) => checkRequest({ engine: embeddedEngine(report) });

describe("runCheck with an embedded runner", () => {
  it("lists mechanism-not-run for a not-included projection", async () => {
    await expect(runCheck(embeddedCheck({ hits: [], nativeExceptions: [], projection: "not-included" }))).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, unmeasured: [{ kind: "mechanism-not-run", mechanism: "audit", projection: "not-included", nestedConfigurations: [] }] },
    });
  });

  it("lists mechanism-not-run for a missing projection", async () => {
    await expect(runCheck(embeddedCheck({ hits: [], nativeExceptions: [], projection: "missing" }))).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, unmeasured: [{ kind: "mechanism-not-run", mechanism: "audit", projection: "missing" }] },
    });
  });

  it("lists an out-of-date projection as a projection problem beside the run's findings", async () => {
    const engine = embeddedEngine({ hits: [HIT_IN_A], nativeExceptions: [], projection: "out-of-date" });
    await expect(runCheck(checkRequest({ engine, path: pathJoining(joiningReadFirstPaths()) }))).resolves.toEqual({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        findings: [{ ...HIT_IN_A, mechanism: "audit" }],
        readFirst: [ASSESSMENT_NOT_WRITTEN, CLASS_SYNTAX_READING_FIRST],
        projectionProblems: [{ scope: "projection", mechanism: "audit", state: "out-of-date" }],
      },
    });
  });

  it("lists each package slice problem under the mechanism, naming the slice, beside a current root projection", async () => {
    await expect(
      runCheck(
        embeddedCheck({
          hits: [],
          nativeExceptions: [],
          projection: "current",
          slices: [
            { slice: repoPathSchema.parse("packages/a/disciplines.eslint.mjs"), state: "out-of-date" },
            { slice: repoPathSchema.parse("packages/b/disciplines.eslint.mjs"), state: "missing" },
          ],
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        projectionProblems: [
          { scope: "slice", mechanism: "audit", state: "out-of-date", slice: "packages/a/disciplines.eslint.mjs" },
          { scope: "slice", mechanism: "audit", state: "missing", slice: "packages/b/disciplines.eslint.mjs" },
        ],
      },
    });
  });

  it("names a package slice no package config applies beside the mechanism it left unmeasured", async () => {
    await expect(
      runCheck(
        embeddedCheck({
          hits: [],
          nativeExceptions: [],
          projection: "not-included",
          slices: [{ slice: repoPathSchema.parse("packages/a/disciplines.eslint.mjs"), state: "not-applied" }],
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        unmeasured: [{ kind: "mechanism-not-run", mechanism: "audit", projection: "not-included", nestedConfigurations: [] }],
        projectionProblems: [{ scope: "slice", mechanism: "audit", state: "not-applied", slice: "packages/a/disciplines.eslint.mjs" }],
      },
    });
  });

  it("explains a not-included projection by each folder holding its own disciplines.json the runner names, leaving the assessment whole", async () => {
    await expect(
      runCheck(
        embeddedCheck({
          hits: [],
          nativeExceptions: [],
          projection: "not-included",
          slices: [{ slice: repoPathSchema.parse("packages/b/disciplines.eslint.mjs"), state: "nested-configuration" }],
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        unmeasured: [{ kind: "mechanism-not-run", mechanism: "audit", projection: "not-included", nestedConfigurations: ["packages/b"] }],
      },
    });
  });

  it("lists a native exception of a kind its projection does not write as unrecorded", async () => {
    await expect(
      runCheck(
        embeddedCheck({
          hits: [],
          nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/a.ts") }],
          projection: "current",
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, unrecorded: [{ kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", mechanism: "audit" }] },
    });
  });

  it("records a config override an authorised location names, since its projection writes that kind, and does not list that record as stale", async () => {
    await expect(
      runCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/src/factory.ts"),
          ),
          exceptionRepository: exceptionRepositoryAtBase({ working: [firstInSingleFile(AUTHORISED_FACTORY)], base: { outcome: "ok", value: [AUTHORISED_FACTORY] } }),
          exceptionEntryParser: parserReading({ reading: { records: [AUTHORISED_FACTORY_RECORD], invalid: [] }, imported: "present" }),
          engine: embeddedEngine({
            hits: [],
            nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/factory.ts") }],
            projection: "current",
          }),
          git: FACTORY_ONLY_GIT,
        }),
      ),
    ).resolves.toEqual({ outcome: "ok", value: EMPTY_REPORT });
  });

  it("hands the engine's run only the records of its own mechanism", async () => {
    const engine = embeddedEngine({ hits: [], nativeExceptions: [], projection: "current" });
    await runCheck(
      checkRequest({
        selectionRepository: selectionRepositoryReading(TWO_MECHANISM_READING),
        exceptionRepository: exceptionRepositoryAtBase({
          working: [firstInSingleFile(WALKER_LOCATION), secondInSingleFile(LINT_LOCATION)],
          base: { outcome: "ok", value: [WALKER_LOCATION, LINT_LOCATION] },
        }),
        exceptionEntryParser: parserReading({ reading: { records: [WALKER_RECORD, LINT_RECORD], invalid: [] }, imported: "present" }),
        engine,
      }),
    );
    expect(engine.run.withRecords).toHaveBeenCalledTimes(2);
    expect(engine.run.withRecords).toHaveBeenCalledWith(expect.objectContaining({ mechanism: "audit", records: [WALKER_RECORD] }));
    expect(engine.run.withRecords).toHaveBeenCalledWith(expect.objectContaining({ mechanism: "eslint", records: [LINT_RECORD] }));
  });
});

describe("runCheck clauses not adopted", () => {
  it("loads no mechanism when no listed clause is adopted, lists the clauses, and passes as a whole assessment", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    const report = await runCheck(
      checkRequest({
        engine,
        selectionRepository: selectionRepositoryReading({
          ...SELECTION_READING,
          selection: { ...SELECTION_READING.selection, selected: [], notAdopted: [CLASS_SYNTAX, ABSTRACT_SYNTAX] },
          bindings: [],
          clauseRoots: [],
        }),
      }),
    );
    expect(report).toEqual({ outcome: "ok", value: { ...EMPTY_REPORT, notAdopted: [CLASS_SYNTAX_OBJECT, ABSTRACT_SYNTAX_OBJECT] } });
    expect(engine.load).not.toHaveBeenCalled();
  });

  it("hands the engine only the adopted clause and lists the other as not adopted", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    const report = await runCheck(
      checkRequest({
        engine,
        selectionRepository: selectionRepositoryReading({
          ...ABSTRACT_SYNTAX_ONLY_READING,
          selection: { ...ABSTRACT_SYNTAX_ONLY_READING.selection, notAdopted: [CLASS_SYNTAX] },
        }),
      }),
    );
    expect(report).toEqual({ outcome: "ok", value: { ...EMPTY_REPORT, notAdopted: [CLASS_SYNTAX_OBJECT] } });
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ run: expect.objectContaining({ clauses: [expect.objectContaining({ address: ABSTRACT_SYNTAX_OBJECT })] }) }),
    );
  });
});

const declaringCheck = (request: { readonly roots: readonly RepoPath[]; readonly excluded: readonly RepoPath[]; readonly engine: EnginePort }) =>
  checkRequest({
    selectionRepository: selectionRepositoryReading({ ...SELECTION_READING, excluded: request.excluded, eslintConfigRoots: request.roots }),
    engine: request.engine,
  });

const CURRENT_REPORT: EmbeddedReport = { hits: [], nativeExceptions: [], projection: "current" };

describe("runCheck with ESLint config roots declared in disciplines.json", () => {
  it("hands an embedded runner each declared folder git tracks, spelled as git spells it", async () => {
    const engine = embeddedEngine(CURRENT_REPORT);
    await runCheck(declaringCheck({ roots: [repoPathSchema.parse("src")], excluded: [], engine }));
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ declaredConfigRoots: ["src"] }));
  });

  it.each([
    { name: "a folder git does not track", root: "packages/missing" },
    { name: "a tracked file rather than a folder", root: "src/a.ts" },
    { name: "a tracked folder spelled in another case", root: "SRC" },
  ])("is the load failure config-root-untracked for $name, running nothing", async ({ root }) => {
    const engine = embeddedEngine(CURRENT_REPORT);
    await expect(runCheck(declaringCheck({ roots: [repoPathSchema.parse(root)], excluded: [], engine }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "config-root-untracked", root },
    });
    expect(engine.run.withRecords).not.toHaveBeenCalled();
  });

  it("is the load failure config-root-untracked for a tracked folder the selection excludes", async () => {
    const engine = embeddedEngine(CURRENT_REPORT);
    const src = repoPathSchema.parse("src");
    await expect(runCheck(declaringCheck({ roots: [src], excluded: [src], engine }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "config-root-untracked", root: "src" },
    });
  });
});

describe("runCheck clauses adopted but not run", () => {
  it("runs only the clause whose mechanism runs, lists the other as not run, and passes as a whole assessment", async () => {
    const engine = standaloneEngine(CLEAN_ENGINE_REPORT);
    const report = await runCheck(
      checkRequest({
        engine,
        selectionRepository: selectionRepositoryReading({
          ...ABSTRACT_SYNTAX_ONLY_READING,
          selection: { ...ABSTRACT_SYNTAX_ONLY_READING.selection, notRun: [CLASS_SYNTAX] },
        }),
      }),
    );
    expect(report).toEqual({ outcome: "ok", value: { ...EMPTY_REPORT, notRun: [CLASS_SYNTAX_OBJECT] } });
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ run: expect.objectContaining({ clauses: [expect.objectContaining({ address: ABSTRACT_SYNTAX_OBJECT })] }) }),
    );
  });
});

const hitEngine = (): EnginePort =>
  standaloneEngine({ hits: [HIT_IN_A, { ...HIT_IN_A, anchor: { line: 9, column: 0 } }], nativeExceptions: [], measured: [] });

describe("runCheck pointing a failing clause at where to read first", () => {
  it("points once at the clause's assessment section and its rule page, however many findings it has", async () => {
    const report = await runCheck(
      checkRequest({
        path: pathJoining(
          joiningTrackedPaths()
            .mockReturnValueOnce("/repo/disciplines.assessment.md")
            .mockReturnValueOnce("/install/rules/CD-14/README.md"),
        ),
        engine: hitEngine(),
        fileText: fileTextOver({ ...INSTALL, [ASSESSMENT_PATH]: presentFile({ text: "# Disciplines assessment\n\n## CD-14#class-syntax\n" }) }),
      }),
    );
    expect(report).toMatchObject({ outcome: "ok", value: { readFirst: [{ ...CLASS_SYNTAX_READING_FIRST, assessmentSection: "present" }] } });
  });

  it("reads neither the assessment file nor the rule page when there are no findings", async () => {
    const fileText = fileTextOver(INSTALL);
    const reads = vi.spyOn(fileText, "read");
    const checks = vi.spyOn(fileText, "exists");
    await runCheck(checkRequest({ fileText }));
    expect(reads).not.toHaveBeenCalledWith({ path: ASSESSMENT_PATH });
    expect(checks).not.toHaveBeenCalledWith({ path: ASSESSMENT_PATH });
    expect(reads).not.toHaveBeenCalledWith({ path: RULE_PAGE_PATH });
    expect(checks).not.toHaveBeenCalledWith({ path: RULE_PAGE_PATH });
  });
});

const LEGACY_CHAIN_FACTORY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
  whyChain: LEGACY_WHY_CHAIN,
};

const LEGACY_CHAIN_FACTORY_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
  whyChain: LEGACY_WHY_CHAIN,
};

const REASON_ONLY_FACTORY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
};

const REASON_ONLY_FACTORY_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
};

const LEGACY_CHAIN_REFUSED: InvalidRecord = {
  place: FIRST_PLACE,
  problem: {
    kind: "why-chain-refused",
    detail:
      "a new or edited entry's whyChain follows the causal contract (docs/why-chain-contract.md in the @hailstails/hone package); a chain without rootCheck and readback is accepted only while --base-revision holds its entry unchanged\n✖ `whyChain.rootCheck` is required beside `readback` in a causal chain: name what was run or read today that shows the root still holds, with a path, record, measurement or link\n  → at rootCheck\n✖ `whyChain.readback` is required beside `rootCheck` in a causal chain: read from the root back to the symptom with \"therefore\"\n  → at readback",
  },
};

const BASE_UNREADABLE: GitFailure = { kind: "git-failed", command: "git show", detail: "fatal: not a tree object" };

const legacyChainCheck = (request: { readonly base: ReturnType<ExceptionRepository["readAt"]>; readonly parser: ExceptionEntryParser }) =>
  checkRequest({
    exceptionRepository: exceptionRepositoryAtBase({ working: [firstInSingleFile(LEGACY_CHAIN_FACTORY)], base: request.base }),
    exceptionEntryParser: request.parser,
    git: FACTORY_ONLY_GIT,
    path: pathJoining(vi.fn<PathPort["join"]>().mockReturnValueOnce("/repo/src/factory.ts")),
  });

describe("runCheck handing each unit its input and reporting its answer", () => {
  it("reports what the measurement leaves unmeasured: a legacy chain, when the records cannot be read at the base revision", async () => {
    await expect(
      runCheck(legacyChainCheck({ base: { outcome: "failed", error: BASE_UNREADABLE }, parser: parserHolding([LEGACY_CHAIN_FACTORY_RECORD]) })),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { unmeasured: [{ kind: "legacy-chain-unmeasured", base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" } }] },
    });
  });

  it("asks for the records at the base revision it was given", async () => {
    const check = legacyChainCheck({ base: { outcome: "ok", value: [] }, parser: parserRefusing([LEGACY_CHAIN_REFUSED]) });
    await runCheck(check);
    expect(check.exceptionRepository.readAt).toHaveBeenCalledExactlyOnceWith({ revision: "main" });
  });

  it("judges the records against the baseline it measured, refusing a legacy chain the base revision does not hold", async () => {
    const parser = parserRefusing([LEGACY_CHAIN_REFUSED]);
    await expect(runCheck(legacyChainCheck({ base: { outcome: "ok", value: [] }, parser }))).resolves.toMatchObject({
      outcome: "ok",
      value: { invalidRecords: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] },
    });
    expect(parser.parseExceptionEntries).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        entries: [firstInSingleFile(LEGACY_CHAIN_FACTORY)],
        baseline: { measured: "yes", entriesAtBase: [], sourceTextsAtBase: new Map(), basePathOfRenamed: new Map() },
      }),
    );
  });

  it("judges the records against the selection, naming a record on a clause not adopted and one on a clause not run", async () => {
    const parser = parserRefusing([
      { place: FIRST_PLACE, problem: { kind: "clause-not-adopted", clause: ABSTRACT_SYNTAX } },
      { place: SECOND_PLACE, problem: { kind: "clause-not-run", clause: NO_FOR_OF } },
    ]);
    await expect(
      runCheck(
        checkRequest({
          selectionRepository: selectionRepositoryReading({
            ...SELECTION_READING,
            selection: { ...SELECTION_READING.selection, notAdopted: [ABSTRACT_SYNTAX], notRun: [NO_FOR_OF] },
          }),
          exceptionRepository: exceptionRepositoryHolding({
            working: [
              firstInSingleFile({ ...REASON_ONLY_FACTORY, clause: "CD-14#abstract-syntax", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN }),
              secondInSingleFile({ ...REASON_ONLY_FACTORY, clause: "CD-15#no-for-of", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN }),
            ],
          }),
          exceptionEntryParser: parser,
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { invalidRecords: [{ problem: { kind: "clause-not-adopted" } }, { problem: { kind: "clause-not-run" } }] },
    });
    expect(parser.parseExceptionEntries).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        selection: { selected: [SELECTED_CLASS_SYNTAX], uncovered: [], notAdopted: [ABSTRACT_SYNTAX], notRun: [NO_FOR_OF], editions: [] },
      }),
    );
  });

  it("judges an authorised location by the why-chain rule the selection reads: refused for a reason alone when chains are required", async () => {
    const parser = parserRefusing([{ place: FIRST_PLACE, problem: { kind: "evidence-refused", detail: "✖ Invalid input" } }]);
    await expect(
      runCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/src/factory.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(REASON_ONLY_FACTORY)] }),
          exceptionEntryParser: parser,
          git: FACTORY_ONLY_GIT,
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        invalidRecords: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "evidence-refused" } }],
      },
    });
    expect(parser.parseExceptionEntries).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ fileExceptionWhyChains: "required" }));
  });

  it("judges an authorised location by the why-chain rule the selection reads: held for a reason alone when chains are optional", async () => {
    const parser = parserHolding([REASON_ONLY_FACTORY_RECORD]);
    await expect(
      runCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/src/factory.ts"),
          ),
          selectionRepository: selectionRepositoryReading({ ...SELECTION_READING, fileExceptionWhyChains: "optional" }),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(REASON_ONLY_FACTORY)] }),
          exceptionEntryParser: parser,
          git: FACTORY_ONLY_GIT,
        }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { invalidRecords: [], stale: [{ file: "src/factory.ts" }] } });
    expect(parser.parseExceptionEntries).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ fileExceptionWhyChains: "optional" }));
  });
});

const carveOutOn = (file: string): StructuralExceptionEntry => ({ ...CARVE_OUT_ON_GONE, file });

const unchangedGitTracking = (tracked: readonly RepoPath[]): GitPort =>
  gitMeasuring({ trackedPaths: { outcome: "ok", value: tracked }, changedSince: { outcome: "ok", value: [] } });

const CARVE_OUT_ON_A = firstInSingleFile(carveOutOn("src/a.ts"));

const runnerMeasuring = (measured: readonly MeasuredPair[]): EnginePort => standaloneEngine({ hits: [], nativeExceptions: [], measured });

const CLAUSE_WIDE_CLASS_SYNTAX: StructuralExceptionEntry = {
  kind: "clause-wide-carve-out",
  clause: "CD-14#class-syntax",
  reason: "the team's config turns class-syntax off where it migrates",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const CLAUSE_WIDE_CLASS_SYNTAX_RECORD: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  reason: "the team's config turns class-syntax off where it migrates",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const STALE_CARVE_OUT_ON_A = carveOutRecordOn("src/a.ts");

describe("runReachedCheck handing on debt on a file still on disk from what its runner measured", () => {
  it("hands on a stale file carve-out whose clause its runner measured on that file, pointing at it", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [CARVE_OUT_ON_A] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A]),
          engine: runnerMeasuring([{ clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/a.ts") }]),
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [{ clause: CLASS_SYNTAX, file: "src/a.ts" }],
        report: { ...EMPTY_REPORT, stale: [STALE_CARVE_OUT_ON_A], readFirst: [{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }] },
        unprojected: [],
      },
    });
  });

  it("hands on nothing for a stale file carve-out on a file still on disk when its mechanism did not run, its projection missing", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          engine: embeddedEngine({ hits: [], nativeExceptions: [], projection: "missing" }),
          exceptionRepository: exceptionRepositoryHolding({ working: [CARVE_OUT_ON_A] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A]),
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [],
        report: { ...EMPTY_REPORT, stale: [STALE_CARVE_OUT_ON_A], unmeasured: [{ kind: "mechanism-not-run", mechanism: "audit", projection: "missing" }] },
        unprojected: [],
      },
    });
  });

  it("hands the run no file the selection excludes, and refuses it, handing on nothing, when the engine finds its runner claimed one", async () => {
    const engine = engineFailing({
      kind: "runner-invalid-output",
      detail: "a measured pair names CD-14#class-syntax in src/a.ts, which the request did not hold",
    });
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/README.md")
              .mockReturnValueOnce("/repo/package.json"),
          ),
          selectionRepository: selectionRepositoryReading({ ...SELECTION_READING, excluded: [repoPathSchema.parse("src")] }),
          exceptionRepository: exceptionRepositoryHolding({ working: [CARVE_OUT_ON_A] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A]),
          engine,
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "audit",
        failure: { kind: "runner-invalid-output", detail: "a measured pair names CD-14#class-syntax in src/a.ts, which the request did not hold" },
      },
    });
    expect(engine.run.withRecords).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ run: expect.objectContaining({ files: [], trackedPaths: ["README.md", "package.json"] }) }),
    );
  });

  it("hands on nothing for a forfeited file carve-out whose rule a config override turns off on its file, though a clause-wide carve-out records that override", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [CARVE_OUT_ON_A, secondInSingleFile(CLAUSE_WIDE_CLASS_SYNTAX)] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A, CLAUSE_WIDE_CLASS_SYNTAX_RECORD]),
          engine: embeddedEngine({
            hits: [],
            nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/a.ts") }],
            projection: "current",
            measured: [{ clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/a.ts") }],
          }),
          git: gitMeasuring({ trackedPaths: { outcome: "ok", value: TRACKED_PATHS }, changedSince: { outcome: "ok", value: [repoPathSchema.parse("src/a.ts")] } }),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: { paidDebt: [], report: { ...EMPTY_REPORT, forfeited: [STALE_CARVE_OUT_ON_A] }, unprojected: [] },
    });
  });

  it("hands on nothing for a stale file carve-out on a file its runner was handed but did not measure", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/e.js"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(carveOutOn("src/e.js"))] }),
          exceptionEntryParser: parserHolding([carveOutRecordOn("src/e.js")]),
          engine: runnerMeasuring([{ clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/a.ts") }]),
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: { paidDebt: [], report: { ...EMPTY_REPORT, stale: [{ ...STALE_CARVE_OUT_ON_A, file: "src/e.js" }] }, unprojected: [] },
    });
  });

  it("hands on a stale file carve-out on a file still on disk inside a folder the selection excludes", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/src/a.ts")
              .mockReturnValueOnce("/repo/vendored/kept.ts"),
          ),
          selectionRepository: selectionRepositoryReading({ ...SELECTION_READING, excluded: [repoPathSchema.parse("vendored")] }),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(carveOutOn("vendored/kept.ts"))] }),
          exceptionEntryParser: parserHolding([carveOutRecordOn("vendored/kept.ts")]),
          git: unchangedGitTracking([repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("vendored/kept.ts")]),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [{ clause: CLASS_SYNTAX, file: "vendored/kept.ts" }],
        report: {
          ...EMPTY_REPORT,
          excluded: ["vendored"],
          stale: [{ ...STALE_CARVE_OUT_ON_A, file: "vendored/kept.ts" }],
          readFirst: [{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }],
        },
        unprojected: [],
      },
    });
  });
});

const AUTHORISED_ON_A: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/a.ts",
  reason: "the one class the library's extension point requires",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const AUTHORISED_ON_A_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "the one class the library's extension point requires",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const LEGACY_AUTHORISED_ON_A_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "the one class the library's extension point requires",
  whyChain: LEGACY_WHY_CHAIN,
};

const runnerHittingAndMeasuringA = standaloneEngine({
  hits: [HIT_IN_A],
  nativeExceptions: [],
  measured: [{ clause: CLASS_SYNTAX, file: repoPathSchema.parse("src/a.ts") }],
});

const gitChangingA = gitMeasuring({ trackedPaths: { outcome: "ok", value: TRACKED_PATHS }, changedSince: { outcome: "ok", value: [repoPathSchema.parse("src/a.ts")] } });

describe("runReachedCheck handing on debt whose every finding an authorised location answers", () => {
  it("hands on a forfeited file carve-out on a measured pair whose finding an authorised location in force exempts", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [CARVE_OUT_ON_A, secondInSingleFile(AUTHORISED_ON_A)] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A, AUTHORISED_ON_A_RECORD]),
          engine: runnerHittingAndMeasuringA,
          git: gitChangingA,
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [{ clause: CLASS_SYNTAX, file: "src/a.ts" }],
        report: {
          ...EMPTY_REPORT,
          exempted: [{ finding: { ...HIT_IN_A, mechanism: "audit" }, by: [AUTHORISED_ON_A_RECORD] }],
          forfeited: [STALE_CARVE_OUT_ON_A],
          readFirst: [{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }],
        },
        unprojected: [],
      },
    });
  });

  it("hands on nothing for a forfeited file carve-out whose finding a legacy-chain authorised location exempts while the records at the base revision cannot be read", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          exceptionRepository: exceptionRepositoryAtBase({
            working: [CARVE_OUT_ON_A, secondInSingleFile({ ...AUTHORISED_ON_A, whyChain: LEGACY_WHY_CHAIN })],
            base: { outcome: "failed", error: BASE_UNREADABLE },
          }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A, LEGACY_AUTHORISED_ON_A_RECORD]),
          engine: runnerHittingAndMeasuringA,
          git: gitChangingA,
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [],
        report: {
          ...EMPTY_REPORT,
          exempted: [{ finding: { ...HIT_IN_A, mechanism: "audit" }, by: [LEGACY_AUTHORISED_ON_A_RECORD] }],
          forfeited: [STALE_CARVE_OUT_ON_A],
          unmeasured: [{ kind: "legacy-chain-unmeasured", base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" } }],
        },
        unprojected: [],
      },
    });
  });

  it("hands on a forfeited file carve-out whose finding a legacy-chain authorised location exempts once the base revision holds that location unchanged", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          exceptionRepository: exceptionRepositoryAtBase({
            working: [CARVE_OUT_ON_A, secondInSingleFile({ ...AUTHORISED_ON_A, whyChain: LEGACY_WHY_CHAIN })],
            base: { outcome: "ok", value: [{ ...AUTHORISED_ON_A, whyChain: LEGACY_WHY_CHAIN }] },
          }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A, LEGACY_AUTHORISED_ON_A_RECORD]),
          engine: runnerHittingAndMeasuringA,
          git: gitChangingA,
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [{ clause: CLASS_SYNTAX, file: "src/a.ts" }],
        report: {
          ...EMPTY_REPORT,
          exempted: [{ finding: { ...HIT_IN_A, mechanism: "audit" }, by: [LEGACY_AUTHORISED_ON_A_RECORD] }],
          forfeited: [STALE_CARVE_OUT_ON_A],
          readFirst: [{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }],
        },
        unprojected: [],
      },
    });
  });

  it("hands on nothing for a file carve-out in force beside an authorised location on its pair, which leaves both doubly held", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(joiningReadFirstPaths()),
          exceptionRepository: exceptionRepositoryHolding({ working: [CARVE_OUT_ON_A, secondInSingleFile(AUTHORISED_ON_A)] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A, AUTHORISED_ON_A_RECORD]),
          engine: runnerHittingAndMeasuringA,
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [],
        report: {
          ...EMPTY_REPORT,
          findings: [{ ...HIT_IN_A, mechanism: "audit" }],
          doublyHeld: [{ clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", mechanism: "audit" }],
          readFirst: [ASSESSMENT_NOT_WRITTEN, CLASS_SYNTAX_READING_FIRST],
        },
        unprojected: [],
      },
    });
  });

  it("hands on nothing for a forfeited file carve-out whose finding only a refused authorised location would answer", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts")
              .mockReturnValueOnce("/repo/disciplines.assessment.md")
              .mockReturnValueOnce("/install/ADOPTING.md")
              .mockReturnValueOnce("/install/rules/CD-14/README.md"),
          ),
          exceptionRepository: exceptionRepositoryHolding({
            working: [CARVE_OUT_ON_A, secondInSingleFile({ kind: "authorised-location", clause: "CD-14#class-syntax", file: "src/a.ts", reason: "no chain" })],
          }),
          exceptionEntryParser: parserReading({
            reading: {
              records: [STALE_CARVE_OUT_ON_A],
              invalid: [{ place: SECOND_PLACE, problem: { kind: "evidence-refused", detail: "✖ Invalid input" } }],
            },
            imported: "absent",
          }),
          engine: runnerHittingAndMeasuringA,
          git: gitChangingA,
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        paidDebt: [],
        report: {
          ...EMPTY_REPORT,
          findings: [{ ...HIT_IN_A, mechanism: "audit" }],
          forfeited: [STALE_CARVE_OUT_ON_A],
          invalidRecords: [
            { place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, problem: { kind: "evidence-refused", detail: "✖ Invalid input" } },
          ],
          readFirst: [ASSESSMENT_NOT_WRITTEN, CLASS_SYNTAX_READING_FIRST],
        },
        unprojected: [],
      },
    });
  });
});

describe("runReachedCheck handing on debt on a file no longer on disk", () => {
  it("hands on a stale file carve-out on a file no longer on disk, pointing at it", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/gone.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(CARVE_OUT_ON_GONE)] }),
          exceptionEntryParser: parserHolding([CARVE_OUT_RECORD_ON_GONE]),
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { paidDebt: [{ clause: CLASS_SYNTAX, file: "src/gone.ts" }], report: { readFirst: [{ kind: "paid-debt", fileCarveOuts: 1 }] } },
    });
  });

  it("hands on a forfeited file carve-out on a file no longer on disk that the change set touched", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            vi.fn<PathPort["join"]>()
              .mockReturnValueOnce("/repo/src/a.ts")
              .mockReturnValueOnce("/repo/src/gone.ts")
              .mockReturnValueOnce("/repo/src/gone.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(CARVE_OUT_ON_GONE)] }),
          exceptionEntryParser: parserHolding([CARVE_OUT_RECORD_ON_GONE]),
          git: gitMeasuring({
            trackedPaths: { outcome: "ok", value: [repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("src/gone.ts")] },
            changedSince: { outcome: "ok", value: [repoPathSchema.parse("src/gone.ts")] },
          }),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { paidDebt: [{ clause: CLASS_SYNTAX, file: "src/gone.ts" }], report: { stale: [], forfeited: [{ kind: "file-carve-out", file: "src/gone.ts" }] } },
    });
  });

  it("hands on and points at nothing for a stale file carve-out on a tracked file that still exists and no runner said it measured", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/a.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(carveOutOn("src/a.ts"))] }),
          exceptionEntryParser: parserHolding([STALE_CARVE_OUT_ON_A]),
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { paidDebt: [], report: { stale: [{ kind: "file-carve-out", file: "src/a.ts" }], readFirst: [] } },
    });
  });

  it("hands on and points at nothing for a stale file carve-out on a file on disk that git does not track", async () => {
    await expect(
      runReachedCheck(
        checkRequest({
          path: pathJoining(
            joiningTrackedPaths()
              .mockReturnValueOnce("/repo/src/factory.ts"),
          ),
          exceptionRepository: exceptionRepositoryHolding({ working: [firstInSingleFile(carveOutOn("src/factory.ts"))] }),
          exceptionEntryParser: parserHolding([carveOutRecordOn("src/factory.ts")]),
          git: unchangedGitTracking(TRACKED_PATHS),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { paidDebt: [], report: { stale: [{ kind: "file-carve-out", file: "src/factory.ts" }], readFirst: [] } },
    });
  });
});
