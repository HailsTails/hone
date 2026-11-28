import type {
  NamedEngineProjection,
  NamedEngineRun,
  NamedEngineRunRequest,
} from "../../../../application/ports/engine/engine-run.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type {
  CheckHit,
  CheckMeasurement,
  CheckNativeException,
} from "../../../../domain/runner/check-observations.ts";
import type { ProjectionEntry } from "../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { CaseVerdict } from "../../../../domain/runner/runner-result-types.ts";

export type ChecksRunFailure = RunnerFailure;

export type ChecksRunProjection =
  | { readonly projection: "current"; readonly projectionFile?: RepoPath }
  | Exclude<NamedEngineProjection, { readonly projection: "current" | "current-with-file" }>;

export type NamedChecksRunReport = ChecksRunProjection & {
  readonly inapplicable: readonly CheckMeasurement[];
  readonly hits: readonly CheckHit[];
  readonly nativeExceptions: readonly CheckNativeException[];
} & Omit<
    NamedEngineRun,
    | "mechanism"
    | "coverableKinds"
    | "comparedOutputs"
    | "coverage"
    | "hits"
    | "nativeExceptions"
    | keyof ChecksRunProjection
  >;

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
