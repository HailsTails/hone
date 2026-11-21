import { type RepoPath, repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";

export const fileNameOf = (request: { readonly path: RepoPath }): string => request.path.split("/").at(-1) ?? "";

export const directoryOf = (request: { readonly path: RepoPath }): string => request.path.split("/").slice(0, -1).join("/");

export const repositoryDirectoryOf = (request: { readonly path: RepoPath }): RepoPath | "repo-root" => {
  const directory = repoPathSchema.safeParse(directoryOf(request));
  return directory.success ? directory.data : "repo-root";
};

export const filesNamed = (request: { readonly trackedPaths: readonly RepoPath[]; readonly name: string }): readonly RepoPath[] =>
  request.trackedPaths.filter((path) => fileNameOf({ path }) === request.name);
