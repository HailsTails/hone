import type {
  NamedEngineRun,
  NamedEngineRunRequest,
} from "../../../../application/ports/engine/engine-run.ts";
import type { Result } from "../../../../domain/result.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { ProjectionEntry } from "../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { CaseVerdict } from "../../../../domain/runner/runner-result-types.ts";

export type ChecksRunFailure = RunnerFailure;

export type NamedChecksRunReport = Omit<NamedEngineRun, "mechanism" | "coverableKinds">;

export type NamedChecksRunner<Request extends NamedEngineRunRequest = NamedEngineRunRequest> = {
  readonly run: (request: Request) => Promise<Result<NamedChecksRunReport, ChecksRunFailure>>;
  readonly conform: (request: {
    readonly binding: CheckBinding;
    readonly cases: readonly SourceCase[];
  }) => Promise<Result<readonly CaseVerdict[], RunnerFailure>>;
  readonly project: (
    request: Request,
  ) => Promise<Result<readonly ProjectionEntry[], ChecksRunFailure>>;
};
