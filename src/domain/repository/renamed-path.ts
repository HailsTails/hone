import type { RepoPath } from "./repo-path-types.ts";

export type RenamedPath = {
  readonly basePath: RepoPath;
  readonly content: "unchanged" | "edited";
};

export type RenamedPaths = ReadonlyMap<RepoPath, RenamedPath>;

export const basePathOf = (request: {
  readonly file: RepoPath;
  readonly basePathOfRenamed: RenamedPaths;
}): RepoPath => request.basePathOfRenamed.get(request.file)?.basePath ?? request.file;

export const headPathByBasePathOf = (request: {
  readonly renamed: RenamedPaths;
}): ReadonlyMap<RepoPath, RepoPath> =>
  new Map([...request.renamed].map(([headPath, { basePath }]) => [basePath, headPath]));
