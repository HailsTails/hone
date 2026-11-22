import type { AbsolutePath } from "./absolute-path-types.ts";
import type { RepoPath } from "./repo-path-types.ts";

const BACKSLASH = "\\";

export const absoluteWithin = (request: { readonly root: AbsolutePath; readonly file: RepoPath }): AbsolutePath => {
  const separator = request.root.includes(BACKSLASH) ? BACKSLASH : "/";
  const root = request.root.endsWith(separator) ? request.root.slice(0, -1) : request.root;
  return `${root}${separator}${request.file.replaceAll("/", separator)}` as AbsolutePath;
};
