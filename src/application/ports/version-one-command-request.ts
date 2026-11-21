import type { CommandRequest } from "./command-request.ts";
import type { ShownPathOfRepository } from "./installation/shown-path-of.ts";
import type { ExceptionEntryParser } from "./records/exception-entries.ts";
import type { ExceptionRepositoryOf } from "./records/exception-repository.ts";
import type { SelectionRepositoryOf } from "./selection/selection-repository.ts";

export type VersionOneCommandRequest = CommandRequest & {
  readonly exceptionRepositoryOf: ExceptionRepositoryOf;
  readonly exceptionEntryParser: ExceptionEntryParser;
  readonly selectionRepositoryOf: SelectionRepositoryOf;
  readonly shownPathOfRepository: ShownPathOfRepository;
};
