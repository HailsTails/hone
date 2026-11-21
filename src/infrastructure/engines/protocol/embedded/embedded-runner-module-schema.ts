import type { z } from "zod";
import type { ExceptionRecord } from "../../../discipline-exceptions-folder/exception-records.ts";
import type { AbsolutePath } from "../../../content-files/absolute-path.ts";
import type { RepoPath } from "../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../domain/result.ts";
import type { Equal } from "../runner-module/type-equality.ts";
import type { ReturnedEmbeddedRunReport } from "./embedded-run-report-schema.ts";
import type { RunnerFailure } from "../../../../application/ports/runner-failure.ts";
import type { embeddedRunnerModuleSchema, RunnerClause, RunRequest, StandaloneRunner } from "../runner-module/runner-module-schema.ts";
import type { NativeException, ProjectionWrite } from "../runner-module/runner-result-schema.ts";

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
