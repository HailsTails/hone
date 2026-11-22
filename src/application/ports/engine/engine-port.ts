import type { RunFailureSource } from "../../../domain/report/run-failure.ts";
import type { Result } from "../../../domain/result.ts";
import type { SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { ConformanceFailure } from "../../../domain/runner/conformance-types.ts";
import type { MechanismRun } from "../../../domain/runner/mechanism-run.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../domain/runner/runner-module-types.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { EngineRun, EngineRunRequest, LoadedEngine } from "./engine-run.ts";
import type { MechanismProjectionRequest, MechanismRequest } from "./mechanism-request.ts";
import type { RunnerInvalid, RunnerLocation } from "./runner-location.ts";
import type { LoadedRunner } from "./runner-module.ts";

export type EngineCall = { readonly engine: LoadedEngine; readonly request: EngineRunRequest };

export type ConformanceCall = {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly runner: Pick<LoadedRunner, "conform">;
};

export type EnginePort = {
  readonly load: (request: RunnerLocation) => Promise<Result<LoadedEngine, RunnerInvalid>>;
  readonly run: {
    readonly checks: (request: EngineCall) => Promise<Result<EngineRun, RunFailureSource>>;
    readonly withRecords: (
      request: MechanismRequest,
    ) => Promise<Result<MechanismRun, RunnerFailure>>;
  };
  readonly project: {
    readonly checks: (
      request: EngineCall,
    ) => Promise<Result<readonly ProjectedFile[], RunFailureSource>>;
    readonly withRecords: (
      request: MechanismProjectionRequest,
    ) => Promise<Result<readonly ProjectionWrite[], RunnerFailure>>;
  };
  readonly conform: (
    request: ConformanceCall,
  ) => Promise<Result<readonly ConformanceFailure[], RunnerFailure>>;
};
