import type { GitFailure } from "../repository/git-failure.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";

export type RecordsFolderFailure =
  | { readonly kind: "records-folder-unreadable"; readonly folder: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-unreadable"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-not-json"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "not-a-records-file"; readonly file: RepoPath }
  | { readonly kind: "not-a-records-name"; readonly folder: RepoPath; readonly name: string }
  | GitFailure;
