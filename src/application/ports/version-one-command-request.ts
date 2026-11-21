import type { CommandRequest } from "./command-request.ts";
import type { ExceptionRepositoryOf } from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";

export type VersionOneCommandRequest = CommandRequest & {
  readonly exceptionRepositoryOf: ExceptionRepositoryOf;
};
