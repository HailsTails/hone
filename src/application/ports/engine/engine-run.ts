import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type {
  ChecksSliceProblem,
  MisnamedRuleId,
} from "../../../domain/runner/checks-run-report.ts";
import type { MechanismRun } from "../../../domain/runner/mechanism-run.ts";
import type { NativeException } from "../../../domain/runner/runner-result-types.ts";
import type { ClauseBinding } from "../../../domain/settings/selection/selection.ts";
import type { ChecksRunRequest, LoadedRunner, RunnerCall } from "./runner-module.ts";

export type ParsedChecksRunner = {
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: RunnerCall;
  readonly conform: RunnerCall;
  readonly project: RunnerCall;
};

export type LoadedEngine = {
  readonly mechanism: EngineId;
  readonly runner: LoadedRunner;
  readonly checksRunner: ParsedChecksRunner | undefined;
};

export type EngineRun = Omit<MechanismRun, "slices"> & {
  readonly slices: readonly ChecksSliceProblem[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export type EngineRunRequest = Omit<ChecksRunRequest, "bindings"> & {
  readonly bindings: readonly ClauseBinding[];
};
