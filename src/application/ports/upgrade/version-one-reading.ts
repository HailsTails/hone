import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import type { HeadRecord } from "../../../domain/records/upgrade/head-records.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";

export type VersionOneReading = {
  readonly selection: ConsumerSelectionFile;
  readonly heads: readonly HeadRecord[];
};

export type VersionOneRecordsRoot = { readonly kind: "repository" } | { readonly kind: "folder"; readonly folder: RepoPath };

export type VersionOneFiles = {
  readonly recordsFiles: readonly RepoPath[];
  readonly recordsFolders: readonly RepoPath[];
  readonly recordsRoot: VersionOneRecordsRoot;
  readonly settings: RepoPath;
};
