import type { CheckRequest } from "../../run/check/run-check.ts";
import type { VersionOneCommandRequest } from "../../ports/version-one-command-request.ts";
import type { FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import type { RecordsSourceOf } from "../../../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { foundTreeExceptionsOf } from "./found-tree-exceptions.ts";
import { foundTreeGitOf } from "./found-tree-git.ts";
import { foundTreeRecordsSourceOf } from "./found-tree-records-source.ts";

export const FOUND_TREE_REVISION = "the tree the upgrade found";

export const foundTreeCheckReachOf = (request: {
  readonly check: Pick<CheckRequest, "git" | "fileText" | "path" | "exceptionRepository">;
}): Pick<CheckRequest, "baseRevision" | "git" | "exceptionRepository"> => ({
  baseRevision: FOUND_TREE_REVISION,
  git: foundTreeGitOf({ git: request.check.git, fileText: request.check.fileText, path: request.check.path }),
  exceptionRepository: foundTreeExceptionsOf({ repository: request.check.exceptionRepository }),
});

export const foundTreeRunReachOf = (request: {
  readonly recordsSourceOf: RecordsSourceOf;
  readonly command: Pick<VersionOneCommandRequest, "git" | "path" | "exceptionRepositoryOf"> & { readonly fileText: Pick<FileTextPort, "read" | "exists"> };
}): { readonly baseRevision: string; readonly git: VersionOneCommandRequest["git"]; readonly recordsSourceOf: RecordsSourceOf } => ({
  baseRevision: FOUND_TREE_REVISION,
  git: foundTreeGitOf({ git: request.command.git, fileText: request.command.fileText, path: request.command.path }),
  recordsSourceOf: foundTreeRecordsSourceOf({ recordsSourceOf: request.recordsSourceOf, exceptionsOf: request.command.exceptionRepositoryOf }),
});
