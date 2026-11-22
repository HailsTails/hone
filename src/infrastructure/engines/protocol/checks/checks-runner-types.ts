import type { ChecksRunRequest } from "../../../../application/ports/engine/runner-module.ts";
import type { Result } from "../../../../domain/result.ts";
import type {
  ChecksSliceProblem,
  MisnamedRuleId,
  NotReadyYetFailure,
  ProjectedFile,
} from "../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type {
  Hit,
  MeasuredPair,
  NativeException,
  ProjectionState,
} from "../../../../domain/runner/runner-result-types.ts";
import type { StandaloneRunner } from "../runner-module/runner-module-schema.ts";

export type ChecksRunReport = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
  readonly projection: ProjectionState;
  readonly slices: readonly ChecksSliceProblem[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export type ChecksRunFailure = RunnerFailure | NotReadyYetFailure;

export type ChecksRunner = {
  readonly run: (request: ChecksRunRequest) => Promise<Result<ChecksRunReport, ChecksRunFailure>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (
    request: ChecksRunRequest,
  ) => Promise<Result<readonly ProjectedFile[], ChecksRunFailure>>;
};

export type LoadedChecksRunner = ChecksRunner & {
  readonly projectedKinds: readonly NativeException["kind"][];
};
