import { describe, expect, it, vi } from "vitest";
import type { ExceptionRepository } from "../ports/records/exception-repository.ts";
import type { ExceptionEntryParser } from "../ports/records/exception-entries.ts";
import type { LegacyWhyChain } from "../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import type { PlacedEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionReading, ExceptionRecord } from "../../domain/records/discipline-exceptions/exception-record.ts";
import type { EnginePort } from "../ports/engine/engine-port.ts";
import type { LoadedRunner, RunnerCall } from "../ports/engine/runner-module.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { GitPort } from "../ports/git-port.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { SelectionRepositoryOf } from "../ports/selection/selection-repository.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { SelectionReading } from "../../domain/settings/selection/selection.ts";
import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";
import type { RunnerFailure } from "../../domain/runner/runner-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { FIRST_EDITION } from "../../infrastructure/content-files/edition.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { type ProjectRequest, runProject } from "./run-project.ts";

const SELECTION_PATH = "/repo/disciplines.json";
const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";

const AUDIT = mechanismIdSchema.parse("audit");
const LINT = mechanismIdSchema.parse("lint");
const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");
const ABSTRACT_SYNTAX = clauseAddressSchema.parse("CD-14#abstract-syntax");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const SRC_A = repoPathSchema.parse("src/a.ts");
const ESLINT_PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");
const SINGLE_FILE_RECORDS = repoPathSchema.parse("discipline-exceptions.json");
const SPLIT_LOCATIONS = repoPathSchema.parse("discipline-exceptions/authorised-locations/cd-14.json");

const FIXTURE_SOURCE = "fictional unit fixture core/check/run-project.test.ts; not historical authorisation";

const CLASS_SYNTAX_CLAUSE = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
  settings: { module: "class-syntax.ts" },
  clauseSettings: {},
  edition: FIRST_EDITION,
} as const;

const ABSTRACT_SYNTAX_CLAUSE = {
  address: ABSTRACT_SYNTAX,
  anchor: { kind: "keyword", keyword: "abstract" },
  pieceRoot: "/install/src/infrastructure/engines/lint/CD-14",
  settings: { module: "abstract-syntax.ts" },
  clauseSettings: {},
  edition: FIRST_EDITION,
} as const;

const SELECTION_READING: SelectionReading = {
  selection: { selected: [{ address: CLASS_SYNTAX, mechanism: AUDIT, exceptions: "allowed" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [{ mechanism: AUDIT, clause: CLASS_SYNTAX_CLAUSE }],
  clauseRoots: [{ clause: CLASS_SYNTAX, ruleSetRoot: INSTALL_ROOT }],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
};

const TWO_MECHANISM_READING: SelectionReading = {
  ...SELECTION_READING,
  selection: {
    ...SELECTION_READING.selection,
    selected: [
      { address: CLASS_SYNTAX, mechanism: AUDIT, exceptions: "allowed" },
      { address: ABSTRACT_SYNTAX, mechanism: LINT, exceptions: "allowed" },
    ],
  },
  bindings: [
    { mechanism: AUDIT, clause: CLASS_SYNTAX_CLAUSE },
    { mechanism: LINT, clause: ABSTRACT_SYNTAX_CLAUSE },
  ],
  clauseRoots: [
    { clause: CLASS_SYNTAX, ruleSetRoot: INSTALL_ROOT },
    { clause: ABSTRACT_SYNTAX, ruleSetRoot: INSTALL_ROOT },
  ],
};

const ABSTRACT_NOT_ADOPTED_READING: SelectionReading = {
  ...SELECTION_READING,
  selection: { ...SELECTION_READING.selection, notAdopted: [ABSTRACT_SYNTAX] },
};

const WALKER_LOCATION = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/walker.ts",
  reason: "audit location",
  provenance: { kind: "existing-authorisation", source: FIXTURE_SOURCE },
} as const;

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

const LEGACY_WALKER_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/walker.ts"),
  reason: "audit location",
  whyChain: LEGACY_WHY_CHAIN,
};

const ESLINT_WRITTEN: readonly ProjectionWrite[] = [{ path: ESLINT_PROJECTION, effect: "written" }];

const AUDIT_RUNNER: LoadedRunner = {
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<RunnerCall>(),
  conform: vi.fn<RunnerCall>(),
  project: vi.fn<RunnerCall>(),
};

const LINT_RUNNER: LoadedRunner = { exceptionPath: "standalone", run: vi.fn<RunnerCall>(), conform: vi.fn<RunnerCall>() };

const engineProjecting = (writes: Result<readonly ProjectionWrite[], RunnerFailure>): EnginePort => ({
  load: vi
    .fn<EnginePort["load"]>()
    .mockResolvedValueOnce({ outcome: "ok", value: { mechanism: AUDIT, runner: AUDIT_RUNNER, checksRunner: undefined } })
    .mockResolvedValueOnce({ outcome: "ok", value: { mechanism: LINT, runner: LINT_RUNNER, checksRunner: undefined } }),
  run: { checks: vi.fn<EnginePort["run"]["checks"]>(), withRecords: vi.fn<EnginePort["run"]["withRecords"]>() },
  project: { checks: vi.fn<EnginePort["project"]["checks"]>(), withRecords: vi.fn<EnginePort["project"]["withRecords"]>().mockResolvedValue(writes) },
  conform: vi.fn<EnginePort["conform"]>(),
});

const fileTextOfPresentFiles = (): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const POSIX_JOIN: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/src/a.ts"),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const gitTracking = (tracked: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const selectionReading = (reading: Result<SelectionReading, LoadFailure>): SelectionRepositoryOf =>
  vi.fn<SelectionRepositoryOf>().mockReturnValue({ read: () => reading });

const exceptionRepositoryReading = (entries: Result<readonly PlacedEntry[], LoadFailure>): Pick<ExceptionRepository, "read" | "readAt"> => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue(entries),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
});

const parserReading = (reading: ExceptionReading): ExceptionEntryParser => ({
  parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>().mockReturnValue(reading),
  importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
  importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
});

const projectRequest = (overrides: Partial<ProjectRequest>): ProjectRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  fileText: fileTextOfPresentFiles(),
  engine: engineProjecting({ outcome: "ok", value: [] }),
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  path: POSIX_JOIN,
  git: gitTracking([SRC_A]),
  exceptionRepository: exceptionRepositoryReading({ outcome: "ok", value: [] }),
  exceptionEntryParser: parserReading({ records: [], invalid: [] }),
  selectionRepositoryOf: selectionReading({ outcome: "ok", value: SELECTION_READING }),
  ...overrides,
});

describe("runProject", () => {
  it("returns no projection writes when the engine projects none, writing no file and running nothing", async () => {
    const fileText = fileTextOfPresentFiles();
    const engine = engineProjecting({ outcome: "ok", value: [] });
    const writes = await runProject(projectRequest({ fileText, engine }));
    expect({
      writes,
      fileWrites: vi.mocked(fileText.write).mock.calls,
      runCalls: vi.mocked(engine.run.withRecords).mock.calls,
      checksCalls: vi.mocked(engine.run.checks).mock.calls,
      conformCalls: vi.mocked(engine.conform).mock.calls,
    }).toEqual({
      writes: { outcome: "ok", value: [] },
      fileWrites: [],
      runCalls: [],
      checksCalls: [],
      conformCalls: [],
    });
  });

  it("loads the engine once for the selected mechanism from the install", async () => {
    const engine = engineProjecting({ outcome: "ok", value: [] });
    const modules: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };
    const writes = await runProject(projectRequest({ engine, modules }));
    expect({ writes, loads: vi.mocked(engine.load).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [] },
      loads: [[expect.objectContaining({ installRoot: "/install", moduleExtension: ".ts", modules, path: POSIX_JOIN, mechanism: "audit" })]],
    });
  });

  it("is not a load failure when the exceptions file holds an invalid record", async () => {
    await expect(
      runProject(
        projectRequest({
          exceptionEntryParser: parserReading({
            records: [],
            invalid: [{ place: { layout: "single-file", file: SINGLE_FILE_RECORDS, index: 0 }, problem: { kind: "clause-not-selected", clause: clauseAddressSchema.parse("CD-15#no-for-of") } }],
          }),
        }),
      ),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("is file-malformed for a disciplines.json that is not JSON", async () => {
    await expect(
      runProject(projectRequest({ selectionRepositoryOf: selectionReading({ outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH, detail: "not JSON" } }) })),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH, detail: "not JSON" } });
  });

  it("is file-malformed for a discipline-exceptions.json with an unknown exception kind", async () => {
    await expect(
      runProject(
        projectRequest({ exceptionRepository: exceptionRepositoryReading({ outcome: "failed", error: { kind: "file-malformed", path: EXCEPTIONS_PATH, detail: "unknown exception kind" } }) }),
      ),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "file-malformed", path: EXCEPTIONS_PATH, detail: "unknown exception kind" } });
  });

  it("is runner-invalid for a runner export whose exception path is outside every path", async () => {
    const engine: EnginePort = {
      ...engineProjecting({ outcome: "ok", value: [] }),
      load: vi.fn<EnginePort["load"]>().mockResolvedValue({ outcome: "failed", error: { kind: "runner-invalid", mechanism: AUDIT, detail: "exceptionPath is unknown-path" } }),
    };
    await expect(runProject(projectRequest({ engine }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "audit", detail: "exceptionPath is unknown-path" },
    });
  });
});

describe("runProject with an embedded runner", () => {
  it("returns the runner's projection write without running the check", async () => {
    const engine = engineProjecting({ outcome: "ok", value: ESLINT_WRITTEN });
    const writes = await runProject(projectRequest({ engine }));
    expect({ writes, runCalls: vi.mocked(engine.run.withRecords).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      runCalls: [],
    });
  });

  it("hands the runner's projection only the records of its own mechanism", async () => {
    const engine = engineProjecting({ outcome: "ok", value: [] });
    vi.mocked(engine.project.withRecords).mockResolvedValueOnce({ outcome: "ok", value: ESLINT_WRITTEN });
    const writes = await runProject(
      projectRequest({
        engine,
        selectionRepositoryOf: selectionReading({ outcome: "ok", value: TWO_MECHANISM_READING }),
        exceptionEntryParser: parserReading({ records: [WALKER_RECORD, LINT_RECORD], invalid: [] }),
      }),
    );
    expect({ writes, projectCalls: vi.mocked(engine.project.withRecords).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      projectCalls: [
        [{ runner: AUDIT_RUNNER, request: expect.objectContaining({ records: [WALKER_RECORD] }) }],
        [{ runner: LINT_RUNNER, request: expect.objectContaining({ records: [LINT_RECORD] }) }],
      ],
    });
  });

  it("hands the parser the entries the exception repository reads, and the runner's projection the records it parses", async () => {
    const engine = engineProjecting({ outcome: "ok", value: [] });
    const splitEntries: readonly PlacedEntry[] = [{ place: { layout: "split", file: SPLIT_LOCATIONS, index: 0 }, entry: WALKER_LOCATION }];
    const exceptionEntryParser = parserReading({ records: [WALKER_RECORD], invalid: [] });

    await runProject(projectRequest({ engine, exceptionRepository: exceptionRepositoryReading({ outcome: "ok", value: splitEntries }), exceptionEntryParser }));

    expect({
      parsed: vi.mocked(exceptionEntryParser.parseExceptionEntries).mock.calls,
      projectCalls: vi.mocked(engine.project.withRecords).mock.calls,
    }).toEqual({
      parsed: [
        [
          {
            entries: [{ place: { layout: "split", file: "discipline-exceptions/authorised-locations/cd-14.json", index: 0 }, entry: WALKER_LOCATION }],
            selection: SELECTION_READING.selection,
            baseline: { measured: "no", base: { state: "not-given" } },
            fileExceptionWhyChains: "required",
          },
        ],
      ],
      projectCalls: [[{ runner: AUDIT_RUNNER, request: expect.objectContaining({ records: [WALKER_RECORD] }) }]],
    });
  });

  it("projects a record whose why-chain predates the causal contract, reading no base revision", async () => {
    const engine = engineProjecting({ outcome: "ok", value: ESLINT_WRITTEN });
    const exceptionRepository = exceptionRepositoryReading({ outcome: "ok", value: [] });
    const writes = await runProject(projectRequest({ engine, exceptionRepository, exceptionEntryParser: parserReading({ records: [LEGACY_WALKER_RECORD], invalid: [] }) }));
    expect({ writes, baseReads: vi.mocked(exceptionRepository.readAt).mock.calls, projectCalls: vi.mocked(engine.project.withRecords).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      baseReads: [],
      projectCalls: [
        [
          {
            runner: AUDIT_RUNNER,
            request: expect.objectContaining({
              records: [
                {
                  kind: "authorised-location",
                  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
                  mechanism: "audit",
                  file: "src/walker.ts",
                  reason: "audit location",
                  whyChain: LEGACY_WHY_CHAIN,
                },
              ],
            }),
          },
        ],
      ],
    });
  });
});

describe("runProject for a repository that does not adopt a clause", () => {
  it("projects only the adopted clause and never loads the mechanism of the clause not adopted", async () => {
    const engine = engineProjecting({ outcome: "ok", value: ESLINT_WRITTEN });
    const writes = await runProject(projectRequest({ engine, selectionRepositoryOf: selectionReading({ outcome: "ok", value: ABSTRACT_NOT_ADOPTED_READING }) }));
    expect({ writes, loads: vi.mocked(engine.load).mock.calls, projectCalls: vi.mocked(engine.project.withRecords).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      loads: [[expect.objectContaining({ mechanism: "audit" })]],
      projectCalls: [
        [{ runner: AUDIT_RUNNER, request: expect.objectContaining({ clauses: [expect.objectContaining({ address: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" } })], records: [] }) }],
      ],
    });
  });
});

describe("runProject for a repository with a package config and a clause it does not adopt", () => {
  it("hands the runner the tracked package config and only the adopted clause, so no slice holds the clause not adopted", async () => {
    const engine = engineProjecting({ outcome: "ok", value: [] });
    await runProject(
      projectRequest({
        engine,
        git: gitTracking([SRC_A, repoPathSchema.parse("packages/a/eslint.config.mjs")]),
        selectionRepositoryOf: selectionReading({ outcome: "ok", value: ABSTRACT_NOT_ADOPTED_READING }),
      }),
    );
    expect(vi.mocked(engine.project.withRecords).mock.calls).toEqual([
      [
        {
          runner: AUDIT_RUNNER,
          request: expect.objectContaining({
            trackedPaths: ["src/a.ts", "packages/a/eslint.config.mjs"],
            clauses: [expect.objectContaining({ address: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" } })],
          }),
        },
      ],
    ]);
  });
});

describe("runProject with an ESLint config root git does not track", () => {
  it("is the load failure config-root-untracked and projects nothing", async () => {
    const engine = engineProjecting({ outcome: "ok", value: [] });
    const outcome = await runProject(
      projectRequest({
        engine,
        selectionRepositoryOf: selectionReading({ outcome: "ok", value: { ...SELECTION_READING, eslintConfigRoots: [repoPathSchema.parse("packages/missing")] } }),
      }),
    );
    expect({ outcome, projectCalls: vi.mocked(engine.project.withRecords).mock.calls }).toEqual({
      outcome: { outcome: "failed", error: { kind: "config-root-untracked", root: "packages/missing" } },
      projectCalls: [],
    });
  });

  it("hands the runner each declared folder git tracks", async () => {
    const engine = engineProjecting({ outcome: "ok", value: [] });
    await runProject(
      projectRequest({
        engine,
        selectionRepositoryOf: selectionReading({ outcome: "ok", value: { ...SELECTION_READING, eslintConfigRoots: [repoPathSchema.parse("src")] } }),
      }),
    );
    expect(vi.mocked(engine.project.withRecords).mock.calls).toEqual([[{ runner: AUDIT_RUNNER, request: expect.objectContaining({ declaredConfigRoots: ["src"] }) }]]);
  });
});

