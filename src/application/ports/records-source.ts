import type { GitFailure } from "../../infrastructure/git/git-port.ts";
import type { RepoPath } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { RecordsDocument } from "../../infrastructure/hone-records-folder/hone-record.ts";

export type RecordsFolderFailure =
  | { readonly kind: "records-folder-unreadable"; readonly folder: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-unreadable"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-not-json"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "not-a-records-file"; readonly file: RepoPath }
  | { readonly kind: "not-a-records-name"; readonly folder: RepoPath; readonly name: string }
  | GitFailure;

export type RecordsSource = {
  readonly read: () => Result<readonly RecordsDocument[], RecordsFolderFailure>;
  readonly readAt: (request: { readonly revision: string }) => Result<readonly RecordsDocument[], RecordsFolderFailure>;
};
