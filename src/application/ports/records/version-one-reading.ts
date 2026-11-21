import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { HeadRecordsRefusal } from "../../../domain/records/upgrade/head-records.ts";
import type { SelectionRepository } from "../selection/selection-repository.ts";
import type { VersionOneFiles, VersionOneReading, VersionOneRecordsRoot } from "../upgrade/version-one-reading.ts";
import type { ExceptionRepository } from "./exception-repository.ts";

export type RecordsOnDisk = {
  readonly files: readonly RepoPath[];
  readonly folders: readonly RepoPath[];
  readonly root: VersionOneRecordsRoot;
};

export type RecordsOnDiskOf = (request: { readonly repoRoot: AbsolutePath }) => Result<RecordsOnDisk, LoadFailure>;

export type VersionOneRead = { readonly reading: VersionOneReading; readonly versionOneFiles: VersionOneFiles };

export type VersionOneReadFailure =
  | { readonly kind: "version-one-unreadable"; readonly failure: LoadFailure }
  | { readonly kind: "records-refused"; readonly refusal: HeadRecordsRefusal };

export type VersionOneReadOf = (request: {
  readonly repoRoot: AbsolutePath;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read">;
  readonly recordsOnDisk: RecordsOnDisk;
}) => Result<VersionOneRead, VersionOneReadFailure>;
