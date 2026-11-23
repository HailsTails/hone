import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { RunnerClause } from "../../../domain/runner/runner-module-types.ts";
import type { NativeException } from "../../../domain/runner/runner-result-types.ts";

export type RunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
};

export type ProjectionRequest = {
  readonly repoRoot: AbsolutePath;
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly installRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
  readonly records: readonly ExceptionRecord[];
};

export type RunnerCall = (input: unknown) => Promise<unknown>;

export type LoadedStandaloneRunner = {
  readonly exceptionPath: "standalone";
  readonly run: RunnerCall;
  readonly conform: RunnerCall;
};

export type LoadedRunner =
  | LoadedStandaloneRunner
  | {
      readonly exceptionPath: "embedded";
      readonly projectedKinds: readonly NativeException["kind"][];
      readonly run: RunnerCall;
      readonly conform: RunnerCall;
      readonly project: RunnerCall;
    };
