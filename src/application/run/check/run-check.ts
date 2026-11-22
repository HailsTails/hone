import { type CheckedTree, checkedTreeOf, typescriptFilesOf } from "../checked-tree-of.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";
import type { ClauseBinding, Selection } from "../../../domain/settings/selection/selection.ts";
import type { ClauseRoot } from "../../../domain/settings/selection/selection.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type { ExceptionEntryParser } from "../../ports/records/exception-entries.ts";
import type { ExceptionBaseline } from "../../../domain/records/discipline-exceptions/exception-baseline.ts";
import type { StructuralExceptionEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionRecord, InvalidRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { DebtPair } from "../../../domain/records/discipline-exceptions/debt-pair.ts";
import { paidDebtOf } from "../../../domain/records/discipline-exceptions/paid-debt.ts";
import type { Finding } from "../../../domain/finding/governance.ts";
import { applyGovernance, type GovernanceResult } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../domain/runner/runner-module-types.ts";
import type { LoadedRunner, RunRequest } from "../../ports/engine/runner-module.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { ModuleLoaderPort } from "../../ports/host/module-loader-port.ts";
import type { EnginePort } from "../../ports/engine/engine-port.ts";
import type { LoadedEngine } from "../../ports/engine/engine-run.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Assessment } from "../../../domain/settings/assessment.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { UnprojectedFolder } from "../../../domain/runner/unprojected-folder.ts";
import type { ModuleExtension } from "../../ports/host/module-extension.ts";
import { isRepoPath } from "../../../domain/repository/repo-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type {
  CheckReport,
  ProjectionProblem,
  Unmeasured,
} from "../../../domain/report/check-report.ts";
import { clauseReadingsOf } from "./clause-readings.ts";
import { exceptionBaselineOf, partialAssessmentsOf, touchedSetFor, unmeasuredOf } from "./measurement.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";
import { paidDebtNotesOf } from "../../../domain/report/paid-debt-notes.ts";
import { shownRemediesOf } from "./shown-remedies.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { MechanismRun } from "../../../domain/runner/mechanism-run.ts";

export type CheckRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly baseRevision: string | undefined;
  readonly assessment: Assessment;
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly modules: ModuleLoaderPort;
  readonly engine: EnginePort;
  readonly path: PathPort;
  readonly git: GitPort;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read" | "readAt">;
  readonly exceptionEntryParser: ExceptionEntryParser;
  readonly shownPathOf: ShownPathOf;
};

export type ExceptionBaselineReader = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}) => ExceptionBaseline;

export type LoadRequest = Omit<CheckRequest, "baseRevision" | "assessment" | "git" | "shownPathOf"> & {
  readonly exceptionBaselineOf: ExceptionBaselineReader;
};

export type LoadedMechanism = {
  readonly mechanism: EngineId;
  readonly runner: LoadedRunner;
  readonly clauses: readonly RunnerClause[];
};

export type LoadedInputs = {
  readonly selection: Selection;
  readonly clauseRoots: readonly ClauseRoot[];
  readonly records: readonly ExceptionRecord[];
  readonly invalidRecords: readonly InvalidRecord[];
  readonly mechanisms: readonly LoadedMechanism[];
  readonly excluded: readonly RepoPath[];
  readonly eslintConfigRoots: readonly RepoPath[];
  readonly exceptionBaseline: ExceptionBaseline;
};

const failed = (error: LoadFailure): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error,
});

export const allOk = <Value>(request: {
  readonly results: readonly Result<Value, LoadFailure>[];
}): Result<readonly Value[], LoadFailure> => {
  const [firstFailure] = request.results.flatMap((loadResult) =>
    loadResult.outcome === "failed" ? [loadResult.error] : [],
  );
  if (firstFailure !== undefined) {
    return failed(firstFailure);
  }
  return {
    outcome: "ok",
    value: request.results.flatMap((loadResult) => (loadResult.outcome === "ok" ? [loadResult.value] : [])),
  };
};

export const runnerFailed = <Value>(request: {
  readonly mechanism: EngineId;
  readonly runnerResult: Result<Value, RunnerFailure>;
}): Result<Value, LoadFailure> =>
  request.runnerResult.outcome === "failed"
    ? failed({ kind: "runner-failed", mechanism: request.mechanism, failure: request.runnerResult.error })
    : request.runnerResult;

const distinctMechanisms = (request: { readonly bindings: readonly ClauseBinding[] }): readonly EngineId[] => [
  ...new Set(request.bindings.map((binding) => binding.mechanism)),
];

const clausesOf = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly mechanism: EngineId;
}): readonly RunnerClause[] =>
  request.bindings.filter((binding) => binding.mechanism === request.mechanism).map((binding) => binding.clause);

const loadedMechanism = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly mechanism: EngineId;
  readonly engine: Result<LoadedEngine, LoadFailure>;
}): Result<LoadedMechanism, LoadFailure> => {
  if (request.engine.outcome === "failed") {
    return request.engine;
  }
  return {
    outcome: "ok",
    value: { mechanism: request.mechanism, runner: request.engine.value.runner, clauses: clausesOf(request) },
  };
};

const loadMechanisms = async (
  request: LoadRequest & { readonly bindings: readonly ClauseBinding[] },
): Promise<Result<readonly LoadedMechanism[], LoadFailure>> =>
  allOk({
    results: await Promise.all(
      distinctMechanisms(request).map((mechanism) =>
        request.engine.load({ ...request, mechanism }).then((engine) =>
          loadedMechanism({ bindings: request.bindings, mechanism, engine }),
        ),
      ),
    ),
  });

export const loadInputs = async (request: LoadRequest): Promise<Result<LoadedInputs, LoadFailure>> => {
  const reading = request.selectionRepository.read({});
  if (reading.outcome === "failed") {
    return reading;
  }
  const entries = request.exceptionRepository.read();
  if (entries.outcome === "failed") {
    return entries;
  }
  const exceptionBaseline = request.exceptionBaselineOf({ entries: entries.value.map(({ entry }) => entry) });
  const parsed = request.exceptionEntryParser.parseExceptionEntries({
    entries: entries.value,
    selection: reading.value.selection,
    baseline: exceptionBaseline,
    fileExceptionWhyChains: reading.value.fileExceptionWhyChains,
  });
  const mechanisms = await loadMechanisms({ ...request, bindings: reading.value.bindings });
  if (mechanisms.outcome === "failed") {
    return mechanisms;
  }
  return {
    outcome: "ok",
    value: {
      selection: reading.value.selection,
      clauseRoots: reading.value.clauseRoots,
      records: parsed.records,
      invalidRecords: parsed.invalid,
      mechanisms: mechanisms.value,
      excluded: reading.value.excluded,
      eslintConfigRoots: reading.value.eslintConfigRoots,
      exceptionBaseline,
    },
  };
};

export const recordsOf = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly mechanism: EngineId;
}): readonly ExceptionRecord[] =>
  request.records.filter((record) => record.mechanism === request.mechanism);

export const projectionOutcome = (request: {
  readonly run: MechanismRun;
}): { readonly unmeasured: readonly Unmeasured[]; readonly problems: readonly ProjectionProblem[] } => {
  switch (request.run.projection) {
    case "none":
    case "current":
      return { unmeasured: [], problems: [] };
    case "missing":
      return { unmeasured: [{ kind: "mechanism-not-run", mechanism: request.run.mechanism, projection: "missing" }], problems: [] };
    case "not-included":
      return {
        unmeasured: [
          {
            kind: "mechanism-not-run",
            mechanism: request.run.mechanism,
            projection: "not-included",
            nestedConfigurations: nestedConfigurationsOf(request),
          },
        ],
        problems: [],
      };
    case "out-of-date":
      return { unmeasured: [], problems: [{ scope: "projection", mechanism: request.run.mechanism, state: request.run.projection }] };
  }
};

const NESTED_CONFIGURATION = "nested-configuration";

export const sliceProblemsOf = (request: { readonly run: MechanismRun }): readonly ProjectionProblem[] =>
  request.run.slices.flatMap((slice): readonly ProjectionProblem[] =>
    slice.state === NESTED_CONFIGURATION
      ? []
      : [{ scope: "slice", mechanism: request.run.mechanism, state: slice.state, slice: slice.slice }],
  );

const nestedConfigurationsOf = (request: { readonly run: MechanismRun }): readonly RepoPath[] =>
  request.run.slices.flatMap((slice) => {
    if (slice.state !== NESTED_CONFIGURATION) {
      return [];
    }
    const folder = slice.slice.split("/").slice(0, -1).join("/");
    return isRepoPath(folder) ? [folder] : [];
  });

type TreeRequest = Pick<CheckRequest, "git" | "repoRoot" | "path" | "fileText">;

export const treeOf = (request: { readonly check: TreeRequest; readonly inputs: Pick<LoadedInputs, "excluded" | "eslintConfigRoots"> }): Result<CheckedTree, LoadFailure> =>
  checkedTreeOf({
    git: request.check.git,
    fileText: request.check.fileText,
    path: request.check.path,
    repoRoot: request.check.repoRoot,
    excluded: request.inputs.excluded,
    eslintConfigRoots: request.inputs.eslintConfigRoots,
  });

const runRequestOf = (request: {
  readonly check: CheckRequest;
  readonly tracked: readonly RepoPath[];
  readonly loaded: LoadedMechanism;
}): RunRequest => ({
  repoRoot: request.check.repoRoot,
  installRoot: request.check.installRoot,
  files: typescriptFilesOf({ tracked: request.tracked }),
  trackedPaths: request.tracked,
  clauses: request.loaded.clauses,
});

const mechanismRunOf = (request: {
  readonly check: CheckRequest;
  readonly tracked: readonly RepoPath[];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
  readonly loaded: LoadedMechanism;
}): Promise<Result<MechanismRun, LoadFailure>> =>
  request.check.engine.run.withRecords({
    runner: request.loaded.runner,
    mechanism: request.loaded.mechanism,
    run: runRequestOf(request),
    declaredConfigRoots: request.declaredConfigRoots,
    records: recordsOf({ records: request.records, mechanism: request.loaded.mechanism }),
  }).then((runnerResult) => runnerFailed({ mechanism: request.loaded.mechanism, runnerResult }));

export const mechanismRuns = async (request: {
  readonly check: CheckRequest;
  readonly tree: CheckedTree;
  readonly inputs: LoadedInputs;
}): Promise<Result<readonly MechanismRun[], LoadFailure>> =>
  allOk({
    results: await Promise.all(
      request.inputs.mechanisms.map((loaded) =>
        mechanismRunOf({ check: request.check, ...request.tree, records: request.inputs.records, loaded }),
      ),
    ),
  });

export const findingsOf = (request: { readonly runs: readonly MechanismRun[] }): readonly Finding[] =>
  request.runs.flatMap((run) => run.hits.map((hit) => ({ ...hit, mechanism: run.mechanism })));

const remediedFindingsOf = (request: {
  readonly check: CheckRequest;
  readonly inputs: LoadedInputs;
  readonly runs: readonly MechanismRun[];
}): readonly Finding[] => {
  const findings = findingsOf(request);
  if (!findings.some((finding) => finding.remedy !== undefined)) {
    return findings;
  }
  return shownRemediesOf({ ...request.check, clauseRoots: request.inputs.clauseRoots, findings });
};

const absentFilesOf = (request: {
  readonly check: TreeRequest;
  readonly governed: Pick<GovernanceResult, "stale" | "forfeited">;
}): readonly RepoPath[] => {
  const carvedFiles = [...request.governed.stale, ...request.governed.forfeited].flatMap((record) =>
    record.kind === "file-carve-out" ? [record.file] : [],
  );
  return [...new Set(carvedFiles)].filter(
    (file) => request.check.fileText.exists({ path: request.check.path.join({ segments: [request.check.repoRoot, file] }) }) === "absent",
  );
};

type CheckedReport = {
  readonly report: CheckReport;
  readonly paidDebt: readonly DebtPair[];
};

const checkReportOf = (request: {
  readonly check: CheckRequest;
  readonly assessment: Assessment;
  readonly inputs: LoadedInputs;
  readonly runs: readonly MechanismRun[];
  readonly touched: TouchedSet;
}): CheckedReport => {
  const governed = applyGovernance({
    findings: remediedFindingsOf(request),
    records: request.inputs.records,
    touched: request.touched,
    runs: request.runs,
  });
  const projections = request.runs.map((run) => projectionOutcome({ run }));
  const paidDebt = paidDebtOf({
    ...governed,
    absent: absentFilesOf({ check: request.check, governed }),
    excluded: request.inputs.excluded,
    nativeExceptions: request.runs.flatMap((run) => run.nativeExceptions.map((exception) => ({ ...exception, mechanism: run.mechanism }))),
    measured: request.runs.flatMap((run) => run.measured),
    baseline: request.inputs.exceptionBaseline,
  });
  const report: CheckReport = {
    excluded: request.inputs.excluded,
    notAdopted: request.inputs.selection.notAdopted,
    notRun: request.inputs.selection.notRun,
    editions: request.inputs.selection.editions,
    ...governed,
    uncovered: request.inputs.selection.uncovered,
    invalidRecords: request.inputs.invalidRecords,
    unmeasured: [
      ...unmeasuredOf({ touched: request.touched, ...request.inputs }),
      ...projections.flatMap((projection) => projection.unmeasured),
    ],
    projectionProblems: [
      ...projections.flatMap((projection) => projection.problems),
      ...request.runs.flatMap((run) => sliceProblemsOf({ run })),
    ],
    assessment: partialAssessmentsOf({ assessment: request.assessment, records: request.inputs.records }),
    readFirst: [
      ...clauseReadingsOf({ ...request.check, findings: governed.findings, clauseRoots: request.inputs.clauseRoots }),
      ...paidDebtNotesOf({ governed, paid: paidDebt, runs: request.runs }),
    ],
  };
  return { report, paidDebt };
};

export type ReachedCheck = CheckedReport & {
  readonly unprojected: readonly UnprojectedFolder[];
};

const unprojectedOf = (request: { readonly runs: readonly MechanismRun[] }): readonly UnprojectedFolder[] =>
  request.runs.flatMap((run) => run.unprojectedFolders.map((unprojected) => ({ mechanism: run.mechanism, ...unprojected })));

export const runReachedCheck = async (request: CheckRequest): Promise<Result<ReachedCheck, LoadFailure>> => {
  const inputs = await loadInputs({
    ...request,
    exceptionBaselineOf: ({ entries }) => exceptionBaselineOf({ check: request, entries }),
  });
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tree = treeOf({ check: request, inputs: inputs.value });
  if (tree.outcome === "failed") {
    return tree;
  }
  const runs = await mechanismRuns({ check: request, tree: tree.value, inputs: inputs.value });
  if (runs.outcome === "failed") {
    return runs;
  }
  return {
    outcome: "ok",
    value: {
      ...checkReportOf({
        check: request,
        assessment: request.assessment,
        inputs: inputs.value,
        runs: runs.value,
        touched: touchedSetFor({ check: request, records: inputs.value.records }),
      }),
      unprojected: unprojectedOf({ runs: runs.value }),
    },
  };
};

export const runCheck = (request: CheckRequest): Promise<Result<CheckReport, LoadFailure>> =>
  runReachedCheck(request).then((reached) => (reached.outcome === "failed" ? reached : { outcome: "ok", value: reached.value.report }));
