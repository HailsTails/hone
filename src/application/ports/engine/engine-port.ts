import type { RunFailureSource } from "../../../domain/report/run-failure.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { CheckConformanceFailure } from "../../../domain/runner/conformance-types.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { NamedEngineRun, NamedEngineRunRequest, ParsedNamedRunner } from "./engine-run.ts";
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

export type NamedEngineCall = {
  readonly mechanism: NamedEngineRun["mechanism"];
  readonly runner: ParsedNamedRunner;
  readonly request: NamedEngineRunRequest;
};

export type NamedEngineFailure = Extract<
  RunFailureSource,
  { readonly kind: "runner-invalid" | "runner-failed" }
>;

export type NamedEnginePort = {
  readonly load: (request: RunnerLocation) => Promise<Result<ParsedNamedRunner, RunnerInvalid>>;
  readonly run: (request: NamedEngineCall) => Promise<Result<NamedEngineRun, NamedEngineFailure>>;
  readonly project: (
    request: NamedEngineCall,
  ) => Promise<Result<readonly ProjectedFile[], NamedEngineFailure>>;
  readonly outputPaths: (
    request: NamedEngineCall,
  ) => Promise<Result<readonly RepoPath[], NamedEngineFailure>>;
};
