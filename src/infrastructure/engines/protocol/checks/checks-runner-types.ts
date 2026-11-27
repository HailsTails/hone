import type {
  NamedEngineRun,
  NamedEngineRunRequest,
} from "../../../../application/ports/engine/engine-run.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { CheckMeasurement } from "../../../../domain/runner/check-observations.ts";
import type { ProjectionEntry } from "../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type {
  CaseVerdict,
  ProjectionState,
} from "../../../../domain/runner/runner-result-types.ts";

export type ChecksRunFailure = RunnerFailure;

export type ChecksRunProjection =
  | { readonly projection: "none" | "current"; readonly projectionFile?: RepoPath }
  | {
      readonly projection: Exclude<ProjectionState, "current">;
      readonly projectionFile: RepoPath;
    };

export type NamedChecksRunReport = ChecksRunProjection & {
  readonly inapplicable?: readonly CheckMeasurement[] | undefined;
} & Omit<
    NamedEngineRun,
    "mechanism" | "coverableKinds" | "comparedOutputs" | "coverage" | keyof ChecksRunProjection
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
