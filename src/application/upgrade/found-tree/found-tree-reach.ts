import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type {
  FoundTreeRecordsSourceOf,
  RecordsSourceOf,
} from "../../ports/records/records-source-of.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import type { VersionOneCommandRequest } from "../../ports/version-one-command-request.ts";
import type { VersionOneCheckInput } from "../record-answers/version-one-check-input.ts";
import { foundTreeExceptionsOf } from "./found-tree-exceptions.ts";
import { type FoundTreeChanges, foundTreeGitOf } from "./found-tree-git.ts";

export const FOUND_TREE_REVISION = "the tree the upgrade found";

export const foundTreeCheckReachOf = (request: {
  readonly check: Pick<VersionOneCheckInput, "git" | "fileText" | "path" | "exceptionRepository">;
  readonly loadFailureDetail: LoadFailureDetail;
}): Pick<VersionOneCheckInput, "baseRevision" | "git" | "exceptionRepository"> => ({
  baseRevision: FOUND_TREE_REVISION,
  git: foundTreeGitOf({
    git: request.check.git,
    fileText: request.check.fileText,
    path: request.check.path,
    written: [],
    removed: [],
  }),
  exceptionRepository: foundTreeExceptionsOf({
    repository: request.check.exceptionRepository,
    loadFailureDetail: request.loadFailureDetail,
  }),
});

export const foundTreeRunReachOf = (
  request: FoundTreeChanges & {
    readonly recordsSourceOf: RecordsSourceOf;
    readonly foundTreeRecordsSourceOf: FoundTreeRecordsSourceOf;
    readonly loadFailureDetail: LoadFailureDetail;
    readonly command: Pick<VersionOneCommandRequest, "git" | "path" | "exceptionRepositoryOf"> & {
      readonly fileText: Pick<FileTextPort, "read" | "exists">;
    };
  },
): {
  readonly baseRevision: string;
  readonly git: VersionOneCommandRequest["git"];
  readonly recordsSourceOf: RecordsSourceOf;
} => ({
  baseRevision: FOUND_TREE_REVISION,
  git: foundTreeGitOf({
    git: request.command.git,
    fileText: request.command.fileText,
    path: request.command.path,
    written: request.written,
    removed: request.removed,
  }),
  recordsSourceOf: request.foundTreeRecordsSourceOf({
    recordsSourceOf: request.recordsSourceOf,
    exceptionsOf: (located) =>
      foundTreeExceptionsOf({
        repository: request.command.exceptionRepositoryOf(located),
        loadFailureDetail: request.loadFailureDetail,
      }),
  }),
});
