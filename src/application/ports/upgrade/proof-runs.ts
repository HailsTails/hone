import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofWritten = { readonly written: readonly RepoPath[] };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: (request: ProofWritten) => Promise<Result<RunReport, ProofRunFailure>>;
};

export type ProofRunSources = {
  readonly versionOne: () => Promise<Result<CheckReport, LoadFailure>>;
  readonly versionTwo: (
    request: ProofWritten,
  ) => Promise<Result<{ readonly report: RunReport }, RunLoadFailure>>;
};

export type ProofRunsOf = (sources: ProofRunSources) => ProofRuns;
