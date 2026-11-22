import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";

export type FileMention = {
  readonly file: RepoPath;
  readonly line: number;
};

export type UnreadFile = {
  readonly file: RepoPath;
  readonly detail: string;
};

export type VersionOneMentions = {
  readonly mentions: readonly FileMention[];
  readonly unread: readonly UnreadFile[];
};
