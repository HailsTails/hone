import type { BaseRevisionAvailability } from "./base-revision-availability.ts";
import type { RepoPath } from "./repo-path-types.ts";

export type RenamedPath = {
  readonly basePath: RepoPath;
  readonly content: "unchanged" | "edited";
};

export type RenamedPaths = ReadonlyMap<RepoPath, RenamedPath>;

export type RenamedSinceBase =
  | { readonly measured: "yes"; readonly renamed: RenamedPaths }
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability };

export const basePathOf = (request: {
  readonly file: RepoPath;
  readonly basePathOfRenamed: RenamedPaths;
}): RepoPath => request.basePathOfRenamed.get(request.file)?.basePath ?? request.file;

export const headPathByBasePathOf = (request: {
  readonly renamed: RenamedPaths;
}): ReadonlyMap<RepoPath, RepoPath> =>
  new Map([...request.renamed].map(([headPath, { basePath }]) => [basePath, headPath]));
