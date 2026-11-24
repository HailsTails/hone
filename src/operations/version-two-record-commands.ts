import type { AuthoriseRequest, Authorising } from "../application/ports/authorising.ts";
import type { RecordsEditor } from "../application/ports/records/records-editor.ts";
import type { RecordsReader } from "../application/ports/records/records-reader.ts";
import type { RecordsSource } from "../application/ports/records/records-source.ts";
import type { RecordsStoreOf } from "../application/ports/records/records-store.ts";
import {
  authoriseOf,
  pruneDebtOf,
  type RecordCommandFailure,
  recordDebtOf,
} from "../application/records/record-commands.ts";
import { refreshableProjectionOf } from "../application/run/engines/engine-states.ts";
import {
  settledCatalogueOf,
  type VersionTwoRequest,
  type VersionTwoRun,
  type VersionTwoStages,
  versionTwoRunOver,
} from "../application/run/version-two-run.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { DebtOutcome } from "../domain/records/debt/debt-effects.ts";
import type { PrunableDebt } from "../domain/records/debt/prunable-debt.ts";
import type { RecordRepointing } from "../domain/records/hone-records/records-edit.ts";
import { type RunLoadFailure, runLoadFailureOf } from "../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import type { Result } from "../domain/result.ts";
import type { ForfeitureAssessment } from "../domain/settings/assessment.ts";

export type RecordsSourceFor = (request: { readonly catalogue: SymptomCatalogue }) => RecordsSource;

export type RecordedDebt = {
  readonly outcomes: readonly DebtOutcome[];
  readonly moved: readonly RecordRepointing[];
};

export type VersionTwoRecordInput = {
  readonly stages: VersionTwoStages;
  readonly repoRoot: AbsolutePath;
  readonly recordsSourceFor: RecordsSourceFor;
  readonly recordsStoreOf: RecordsStoreOf;
  readonly recordsReader: RecordsReader;
  readonly recordsEditor: RecordsEditor;
};

const recordFailureOf = <Value>(request: {
  readonly recorded: Result<Value, RecordCommandFailure>;
}): Result<Value, RunLoadFailure> =>
  request.recorded.outcome === "failed"
    ? {
        outcome: "failed",
        error: runLoadFailureOf({ engines: [], source: request.recorded.error }),
      }
    : request.recorded;

type ProjectCommand = { readonly projectCommand: string };

const runOverCurrentProjection = async (
  request: ProjectCommand & {
    readonly stages: VersionTwoStages;
    readonly arguments: VersionTwoRequest;
  },
): Promise<Result<VersionTwoRun, RunLoadFailure>> => {
  const run = await versionTwoRunOver(request);
  if (run.outcome === "failed") {
    return run;
  }
  const { report } = run.value;
  const stale = refreshableProjectionOf({
    problems: report["projection-problems"],
    unmeasured: report.unmeasured,
  });
  return stale === undefined
    ? run
    : {
        outcome: "failed",
        error: { kind: "projection-stale", problem: stale, projectCommand: request.projectCommand },
      };
};

export const versionTwoRecordDebtOf = async (
  request: VersionTwoRecordInput &
    ProjectCommand & {
      readonly leave: readonly RepoPath[];
    },
): Promise<Result<RecordedDebt, RunLoadFailure>> => {
  const run = await runOverCurrentProjection({
    stages: request.stages,
    projectCommand: request.projectCommand,
    arguments: { forfeiture: undefined, reportOutput: undefined, measuring: "always" },
  });
  if (run.outcome === "failed") {
    return run;
  }
  const { catalogue, report, runs, touched, moved } = run.value;
  const recorded = recordFailureOf({
    recorded: recordDebtOf({
      ports: {
        catalogue,
        source: request.recordsSourceFor({ catalogue }),
        store: request.recordsStoreOf({ repoRoot: request.repoRoot }),
        recordsReader: request.recordsReader,
        recordsEditor: request.recordsEditor,
      },
      run: {
        findings: report.findings,
        unrecorded: report.unrecorded,
        runs,
        touched,
        moved,
        leave: request.leave,
      },
    }),
  });
  return recorded.outcome === "failed"
    ? recorded
    : { outcome: "ok", value: { outcomes: recorded.value, moved } };
};

export const versionTwoPruneDebtOf = async (
  request: VersionTwoRecordInput &
    ProjectCommand & { readonly forfeiture: ForfeitureAssessment | undefined },
): Promise<Result<readonly PrunableDebt[], RunLoadFailure>> => {
  const run = await runOverCurrentProjection({
    stages: request.stages,
    projectCommand: request.projectCommand,
    arguments: {
      forfeiture: request.forfeiture,
      reportOutput: undefined,
      measuring: "when-debt-held",
    },
  });
  if (run.outcome === "failed") {
    return run;
  }
  return recordFailureOf({
    recorded: pruneDebtOf({
      ports: {
        source: request.recordsSourceFor({ catalogue: run.value.catalogue }),
        store: request.recordsStoreOf({ repoRoot: request.repoRoot }),
        recordsEditor: request.recordsEditor,
      },
      report: run.value.report,
    }),
  });
};

export const versionTwoAuthoriseOf = (
  request: VersionTwoRecordInput & { readonly authorising: AuthoriseRequest },
): Result<Authorising, RunLoadFailure> => {
  const settled = settledCatalogueOf(request);
  if (settled.outcome === "failed") {
    return settled;
  }
  const { catalogue } = settled.value;
  return recordFailureOf({
    recorded: authoriseOf({
      ports: {
        catalogue,
        source: request.recordsSourceFor({ catalogue }),
        store: request.recordsStoreOf({ repoRoot: request.repoRoot }),
        recordsReader: request.recordsReader,
        recordsEditor: request.recordsEditor,
      },
      request: request.authorising,
    }),
  });
};
