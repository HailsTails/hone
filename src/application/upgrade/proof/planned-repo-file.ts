import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";

export type PlannedRepoFile = { readonly file: RepoPath; readonly text: string };
