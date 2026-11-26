import type { RunFailureSource } from "../../../domain/report/run-failure.ts";
import type { Result } from "../../../domain/result.ts";
import type { SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { CheckConformanceFailure } from "../../../domain/runner/conformance-types.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { NamedEngineRun, NamedEngineRunRequest } from "./engine-run.ts";
import type { RunnerInvalid, RunnerLocation } from "./runner-location.ts";
import type { RunnerCall } from "./runner-module.ts";

export type NamedConformancePort = {
  readonly load: (
    request: RunnerLocation,
  ) => Promise<Result<{ readonly conform: RunnerCall }, RunnerInvalid>>;
  readonly conform: (request: {
    readonly binding: CheckBinding;
    readonly cases: readonly SourceCase[];
    readonly runner: { readonly conform: RunnerCall };
  }) => Promise<Result<readonly CheckConformanceFailure[], RunnerFailure>>;
};

export type NamedEngineFailure = Extract<
  RunFailureSource,
  { readonly kind: "runner-invalid" | "runner-failed" }
>;

export type LoadedEngine = {
  readonly run: (
    request: NamedEngineRunRequest,
  ) => Promise<Result<NamedEngineRun, NamedEngineFailure>>;
  readonly project: (
    request: NamedEngineRunRequest,
  ) => Promise<Result<readonly ProjectedFile[], NamedEngineFailure>>;
};

export type NamedEnginePort = {
  readonly load: (request: RunnerLocation) => Promise<Result<LoadedEngine, RunnerInvalid>>;
};
