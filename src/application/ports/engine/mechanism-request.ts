import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import type { LoadedRunner, ProjectionRequest, RunRequest } from "./runner-module.ts";

export type MechanismRequest = {
  readonly runner: LoadedRunner;
  readonly mechanism: MechanismId;
  readonly run: RunRequest;
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
};

export type MechanismProjectionRequest = {
  readonly runner: LoadedRunner;
  readonly request: ProjectionRequest;
};
