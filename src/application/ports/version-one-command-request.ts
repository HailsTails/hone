import type { CommandRequest } from "./command-request.ts";
import type { ExceptionRepositoryOf } from "./records/exception-repository.ts";

export type VersionOneCommandRequest = CommandRequest & {
  readonly exceptionRepositoryOf: ExceptionRepositoryOf;
};
