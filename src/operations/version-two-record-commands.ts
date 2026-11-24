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
  type VersionTwoStages,
  versionTwoRunOver,
} from "../application/run/version-two-run.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { DebtOutcome } from "../domain/records/debt/debt-effects.ts";
import type { PrunableDebt } from "../domain/records/debt/prunable-debt.ts";
import { renamedDebtFindingsOf } from "../domain/records/debt/renamed-debt-findings.ts";
import { type RunLoadFailure, runLoadFailureOf } from "../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { GitFailure } from "../domain/repository/git-failure.ts";
import type { RenamedPaths } from "../domain/repository/renamed-path.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import type { Result } from "../domain/result.ts";
import type { ForfeitureAssessment } from "../domain/settings/assessment.ts";

export type RecordsSourceFor = (request: { readonly catalogue: SymptomCatalogue }) => RecordsSource;

export type RenamedSince = () => Result<RenamedPaths, GitFailure>;

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

export const versionTwoRecordDebtOf = async (
  request: VersionTwoRecordInput & {
    readonly leave: readonly RepoPath[];
    readonly projectCommand: string;
    readonly renamedSince: RenamedSince;
  },
): Promise<Result<readonly DebtOutcome[], RunLoadFailure>> => {
  const run = await versionTwoRunOver({
    stages: request.stages,
    arguments: { forfeiture: undefined, reportOutput: undefined, measuring: "always" },
  });
  if (run.outcome === "failed") {
    return run;
  }
  const { catalogue, report, runs, touched } = run.value;
  const stale = refreshableProjectionOf({
    problems: report["projection-problems"],
    unmeasured: report.unmeasured,
  });
  if (stale !== undefined) {
    return {
      outcome: "failed",
      error: { kind: "projection-stale", problem: stale, projectCommand: request.projectCommand },
    };
  }
  const renamed = request.renamedSince();
  if (renamed.outcome === "failed") {
    return recordFailureOf({
      recorded: {
        outcome: "failed",
        error: {
          kind: "git-failed",
          detail: `${renamed.error.command}: ${renamed.error.detail}`,
        },
      },
    });
  }
  return recordFailureOf({
    recorded: recordDebtOf({
      ports: {
        catalogue,
        source: request.recordsSourceFor({ catalogue }),
        store: request.recordsStoreOf({ repoRoot: request.repoRoot }),
        recordsReader: request.recordsReader,
        recordsEditor: request.recordsEditor,
      },
      run: {
        findings: [
          ...report.findings,
          ...renamedDebtFindingsOf({ answered: report.answered, renamed: renamed.value }),
        ],
        unrecorded: report.unrecorded,
        runs,
        touched,
        renamed: renamed.value,
        leave: request.leave,
      },
    }),
  });
};

export const versionTwoPruneDebtOf = async (
  request: VersionTwoRecordInput & { readonly forfeiture: ForfeitureAssessment | undefined },
): Promise<Result<readonly PrunableDebt[], RunLoadFailure>> => {
  const run = await versionTwoRunOver({
    stages: request.stages,
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
