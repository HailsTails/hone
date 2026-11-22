import type { RepoPath } from "./repo-path-types.ts";

export const basePathOf = (request: {
  readonly file: RepoPath;
  readonly basePathOfRenamed: ReadonlyMap<RepoPath, RepoPath>;
}): RepoPath => request.basePathOfRenamed.get(request.file) ?? request.file;
