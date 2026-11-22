import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";

export type PlannedRepoFile = { readonly file: RepoPath; readonly text: string };
