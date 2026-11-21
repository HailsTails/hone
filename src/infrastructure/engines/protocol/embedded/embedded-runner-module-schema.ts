import type { z } from "zod";
import type { ExceptionRecord } from "../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { Equal } from "../runner-module/type-equality.ts";
import type { ReturnedEmbeddedRunReport } from "./embedded-run-report-schema.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { embeddedRunnerModuleSchema, RunnerClause, RunRequest, StandaloneRunner } from "../runner-module/runner-module-schema.ts";
import type { NativeException, ProjectionWrite } from "../../../../domain/runner/runner-result-types.ts";

export type ProjectionRequest = {
  readonly repoRoot: AbsolutePath;
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly installRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
  readonly records: readonly ExceptionRecord[];
};

export type EmbeddedRunRequest = RunRequest & {
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
};

export type EmbeddedRunner = {
  readonly exceptionPath: "embedded";
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: (request: EmbeddedRunRequest) => Promise<Result<ReturnedEmbeddedRunReport, RunnerFailure>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (
    request: ProjectionRequest,
  ) => Promise<Result<readonly ProjectionWrite[], RunnerFailure>>;
};

export const isEmbeddedKeySetEqual: Equal<
  keyof EmbeddedRunner,
  keyof z.output<typeof embeddedRunnerModuleSchema>
> = true;

export const isEmbeddedExceptionPathEqual: Equal<
  EmbeddedRunner["exceptionPath"],
  z.output<typeof embeddedRunnerModuleSchema>["exceptionPath"]
> = true;
