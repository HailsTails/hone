import type { RunReport } from "../../../domain/report/run-report.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { Result } from "../../../domain/result.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: () => Promise<Result<RunReport, ProofRunFailure>>;
};
