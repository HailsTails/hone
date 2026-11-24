import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { GitFailure } from "../../domain/repository/git-failure.ts";
import type { RenamedPaths } from "../../domain/repository/renamed-path.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";

export type BaseContentMembership = "present-in-base" | "absent-from-base";

export type BaseFileText =
  | { readonly presence: "absent-from-base" }
  | { readonly presence: "present-in-base"; readonly text: string };

export type GitContentQuery = {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string;
  readonly file: RepoPath;
};

export type GitPort = {
  readonly trackedPaths: (request: {
    readonly repoRoot: AbsolutePath;
  }) => Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: (request: {
    readonly repoRoot: AbsolutePath;
    readonly baseRevision: string;
  }) => Result<readonly RepoPath[], GitFailure>;
  readonly contentInBase: (request: GitContentQuery) => Result<BaseContentMembership, GitFailure>;
  readonly textInBase: (request: GitContentQuery) => Result<BaseFileText, GitFailure>;
  readonly renamedSince: (request: {
    readonly repoRoot: AbsolutePath;
    readonly baseRevision: string;
  }) => Result<RenamedPaths, GitFailure>;
};

export type GitHistoryPort = {
  readonly mergedTags: (request: {
    readonly repoRoot: AbsolutePath;
    readonly pattern: string;
  }) => Result<readonly string[], GitFailure>;
  readonly commitsAfter: (request: {
    readonly repoRoot: AbsolutePath;
    readonly revision: string;
  }) => Result<readonly CommitRecord[], GitFailure>;
};

export type GitTreePort = {
  readonly pathsAt: (request: {
    readonly repoRoot: AbsolutePath;
    readonly revision: string;
  }) => Result<readonly RepoPath[], GitFailure>;
};

export type CommitRecord = { readonly parentCount: number; readonly message: string };
