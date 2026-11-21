import { loadFailureDetail } from "../printed-report/load-failures/load-failure-text.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { runLoadFailureLine } from "../printed-report/load-failures/load-failure-lines.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { Result } from "../../domain/result.ts";
import type { CheckReport } from "../../domain/report/check-report.ts";
import type { ProofRunFailure, ProofRuns } from "../../application/ports/upgrade/proof-runs.ts";

export type ProofRunSources = {
  readonly versionOne: () => Promise<Result<CheckReport, LoadFailure>>;
  readonly versionTwo: () => Promise<Result<{ readonly report: RunReport }, RunLoadFailure>>;
};

const failedWith = (request: { readonly detail: string }): Result<never, ProofRunFailure> => ({
  outcome: "failed",
  error: { kind: "run-failed", detail: request.detail },
});

export const proofRunsOf = (request: ProofRunSources): ProofRuns => ({
  versionOne: async () => {
    const run = await request.versionOne();
    return run.outcome === "failed" ? failedWith({ detail: loadFailureDetail({ failure: run.error }) }) : run;
  },
  versionTwo: async () => {
    const run = await request.versionTwo();
    return run.outcome === "failed"
      ? failedWith({ detail: runLoadFailureLine({ failure: run.error, upgradeCommand: undefined }) })
      : { outcome: "ok", value: run.value.report };
  },
});
