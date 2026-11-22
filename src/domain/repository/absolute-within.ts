import type { AbsolutePath } from "./absolute-path-types.ts";
import type { RepoPath } from "./repo-path-types.ts";

export const absoluteWithin = (request: { readonly root: AbsolutePath; readonly file: RepoPath }): AbsolutePath =>
  `${request.root}/${request.file}` as AbsolutePath;
