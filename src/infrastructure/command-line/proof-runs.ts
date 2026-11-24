import type {
  ProofRunFailure,
  ProofRuns,
  ProofRunSources,
} from "../../application/ports/upgrade/proof-runs.ts";
import type { Result } from "../../domain/result.ts";
import { runLoadFailureLine } from "../printed-report/load-failures/load-failure-lines.ts";
import { loadFailureDetail } from "../printed-report/load-failures/load-failure-text.ts";
import { mapRunReportToFailingLines } from "../printed-report/run-report-text.ts";

const failedWith = (request: { readonly detail: string }): Result<never, ProofRunFailure> => ({
  outcome: "failed",
  error: { kind: "run-failed", detail: request.detail },
});

export const proofRunsOf = (request: ProofRunSources): ProofRuns => ({
  versionOne: async () => {
    const run = await request.versionOne();
    return run.outcome === "failed"
      ? failedWith({ detail: loadFailureDetail({ failure: run.error }) })
      : run;
  },
  versionTwo: async (proofWritten) => {
    const run = await request.versionTwo(proofWritten);
    return run.outcome === "failed"
      ? failedWith({
          detail: runLoadFailureLine({ failure: run.error, upgradeCommand: undefined }),
        })
      : {
          outcome: "ok",
          value: {
            report: run.value.report,
            failing: mapRunReportToFailingLines({
              ...request.pointers,
              report: run.value.report,
              catalogue: run.value.catalogue,
              content: run.value.content,
            }),
          },
        };
  },
});
