import { describe, expect, it, vi } from "vitest";
import type { CheckRequest } from "../../run/check/run-check.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";
import type { LoadedRunner, RunnerCall } from "../../ports/engine/runner-module.ts";
import type { EnginePort } from "../../ports/engine/engine-port.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { ExceptionEntryParser } from "../../ports/records/exception-entries.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { MechanismRun } from "../../../domain/runner/mechanism-run.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { createVersionOneEnginePass } from "./version-one-engine-pass.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const INSTALL_ROOT = absoluteRootOf("/install");

const AUDIT = "walker" as const;

const CLASS_SYNTAX = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") };

const SRC_A = repoPathOf("src/a.ts");

const SLICE = repoPathOf("packages/a/disciplines.audit.mjs");

const CLASS_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const HIT_IN_A = { clause: CLASS_SYNTAX, file: SRC_A, anchor: { line: 3, column: 0 }, snippet: "class A {}" };

const HIT_IN_A_OBJECT = { clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", anchor: { line: 3, column: 0 }, snippet: "class A {}" };

const CARVE_OUT_ON_A: ExceptionRecord = { kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: AUDIT, file: SRC_A, reason: "legacy class" };

const CLASS_SYNTAX_CLAUSE = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  settings: { module: "class-syntax.ts" },
  clauseSettings: {},
  edition: editionOf("1"),
} as const;

const SELECTION_READING: SelectionReading = {
  selection: { selected: [{ address: CLASS_SYNTAX, mechanism: AUDIT, exceptions: "allowed" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [{ mechanism: AUDIT, clause: CLASS_SYNTAX_CLAUSE }],
  clauseRoots: [{ clause: CLASS_SYNTAX, ruleSetRoot: INSTALL_ROOT, checks: [] }],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
};

const RUNNER: LoadedRunner = { exceptionPath: "standalone", run: vi.fn<RunnerCall>(), conform: vi.fn<RunnerCall>() };

const STANDALONE_RUN: MechanismRun = {
  mechanism: AUDIT,
  hits: [HIT_IN_A],
  nativeExceptions: [],
  coverableKinds: ["inline-disable"],
  projection: "none",
  slices: [],
  unprojectedFolders: [],
  measured: [],
};

const EMBEDDED_RUN: MechanismRun = { ...STANDALONE_RUN, coverableKinds: ["config-override"], projection: "current" };

const engineRunning = (run: MechanismRun): EnginePort => ({
  load: vi.fn<EnginePort["load"]>().mockResolvedValue({ outcome: "ok", value: { mechanism: AUDIT, runner: RUNNER, checksRunner: undefined } }),
  run: { checks: vi.fn<EnginePort["run"]["checks"]>(), withRecords: vi.fn<EnginePort["run"]["withRecords"]>().mockResolvedValue({ outcome: "ok", value: run }) },
  project: { checks: vi.fn<EnginePort["project"]["checks"]>(), withRecords: vi.fn<EnginePort["project"]["withRecords"]>() },
  conform: vi.fn<EnginePort["conform"]>(),
});

const gitTracking = (request: { readonly trackedPaths: ReturnType<GitPort["trackedPaths"]> }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(request.trackedPaths),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/src/a.ts"),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const NO_RECORDS_PARSED: ExceptionEntryParser = {
  parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>().mockReturnValue({ records: [], invalid: [] }),
  importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
  importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
};

const checkRequest = (overrides: Partial<CheckRequest>): CheckRequest => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  baseRevision: undefined,
  assessment: { forfeiture: "this-run" },
  fileText: {
    read: vi.fn<CheckRequest["fileText"]["read"]>().mockReturnValue({ outcome: "ok", value: "" }),
    exists: vi.fn<CheckRequest["fileText"]["exists"]>().mockReturnValue("present"),
  },
  engine: engineRunning(STANDALONE_RUN),
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  path: PATH,
  git: gitTracking({ trackedPaths: { outcome: "ok", value: [SRC_A] } }),
  selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: SELECTION_READING }) },
  exceptionRepository: {
    read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
    readAt: vi.fn<ExceptionRepository["readAt"]>(),
  },
  exceptionEntryParser: NO_RECORDS_PARSED,
  shownPathOf: vi.fn<ShownPathOf>(),
  ...overrides,
});

describe("createVersionOneEnginePass", () => {
  it("gives every finding of the engines, unfiltered by the records it was asked with", async () => {
    const engine = engineRunning(STANDALONE_RUN);
    await expect(createVersionOneEnginePass({ loadFailureDetail: vi.fn<LoadFailureDetail>(), check: checkRequest({ engine }) }).findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "ok",
      value: {
        findings: [{ ...HIT_IN_A_OBJECT, mechanism: "walker" }],
        runs: [
          {
            mechanism: "walker",
            hits: [HIT_IN_A_OBJECT],
            nativeExceptions: [],
            coverableKinds: ["inline-disable"],
            projection: "none",
            slices: [],
            unprojectedFolders: [],
            measured: [],
          },
        ],
      },
    });
    expect(engine.run.withRecords).toHaveBeenCalledWith({
      runner: RUNNER,
      mechanism: "walker",
      run: { repoRoot: "/repo", installRoot: "/install", files: ["src/a.ts"], trackedPaths: ["src/a.ts"], clauses: [CLASS_SYNTAX_CLAUSE] },
      declaredConfigRoots: [],
      records: [CARVE_OUT_ON_A],
    });
  });

  it("gives the findings of an embedded runner whose projection is current, its projected kinds as what a record can cover", async () => {
    const pass = createVersionOneEnginePass({ loadFailureDetail: vi.fn<LoadFailureDetail>(), check: checkRequest({ engine: engineRunning(EMBEDDED_RUN) }) });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "ok",
      value: {
        findings: [{ ...HIT_IN_A_OBJECT, mechanism: "walker" }],
        runs: [
          {
            mechanism: "walker",
            hits: [HIT_IN_A_OBJECT],
            nativeExceptions: [],
            coverableKinds: ["config-override"],
            projection: "current",
            slices: [],
            unprojectedFolders: [],
            measured: [],
          },
        ],
      },
    });
  });

  it("fails naming the mechanism when its projection is missing, which version 1 reads as the mechanism not run", async () => {
    const pass = createVersionOneEnginePass({
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
      check: checkRequest({ engine: engineRunning({ ...EMBEDDED_RUN, hits: [], projection: "missing" }) }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.audit.mjs", state: "missing" },
    });
  });

  it("fails naming the mechanism when its projection is not included by the team's configuration", async () => {
    const pass = createVersionOneEnginePass({
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
      check: checkRequest({ engine: engineRunning({ ...EMBEDDED_RUN, hits: [], projection: "not-included" }) }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.audit.mjs", state: "not-included" },
    });
  });

  it("fails naming the mechanism when its projection is out of date, which version 1 itself fails", async () => {
    const pass = createVersionOneEnginePass({
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
      check: checkRequest({ engine: engineRunning({ ...EMBEDDED_RUN, projection: "out-of-date" }) }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.audit.mjs", state: "out-of-date" },
    });
  });

  it("fails naming the slice when a package slice is out of date, though the root projection is current", async () => {
    const pass = createVersionOneEnginePass({
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
      check: checkRequest({ engine: engineRunning({ ...EMBEDDED_RUN, hits: [], slices: [{ slice: SLICE, state: "out-of-date" }] }) }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "packages/a/disciplines.audit.mjs", state: "out-of-date" },
    });
  });

  it("fails naming the slice when its config does not apply it", async () => {
    const pass = createVersionOneEnginePass({
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
      check: checkRequest({ engine: engineRunning({ ...EMBEDDED_RUN, hits: [], slices: [{ slice: SLICE, state: "not-applied" }] }) }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "packages/a/disciplines.audit.mjs", state: "not-applied" },
    });
  });

  it("fails naming the selection's own problem when the version 1 selection cannot be read", async () => {
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue("unexpected-error no selection");
    const pass = createVersionOneEnginePass({
      loadFailureDetail,
      check: checkRequest({
        selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unexpected-error", detail: "no selection" } }) },
      }),
    });
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "unexpected-error no selection" } });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "unexpected-error", detail: "no selection" } });
  });

  it("fails when the repository's tracked files cannot be listed", async () => {
    const loadFailureDetail = vi.fn<LoadFailureDetail>().mockReturnValue("git-failed git ls-files: not a repository");
    const pass = createVersionOneEnginePass({
      loadFailureDetail,
      check: checkRequest({ git: gitTracking({ trackedPaths: { outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" } } }) }),
    });
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "git-failed git ls-files: not a repository" } });
    expect(loadFailureDetail).toHaveBeenCalledWith({ failure: { kind: "git-failed", detail: "git ls-files: not a repository" } });
  });
});
