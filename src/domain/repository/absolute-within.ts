import type { AbsolutePath } from "./absolute-path-types.ts";
import type { RepoPath } from "./repo-path-types.ts";

const BACKSLASH = "\\";

const BACKSLASH_FORM = /^(?:[A-Za-z]:\\|\\\\)/;

export const absoluteWithin = (request: {
  readonly root: AbsolutePath;
  readonly file: RepoPath;
}): AbsolutePath => {
  const separator = BACKSLASH_FORM.test(request.root) ? BACKSLASH : "/";
  const root = request.root.endsWith(separator) ? request.root.slice(0, -1) : request.root;
  return `${root}${separator}${request.file.replaceAll("/", separator)}` as AbsolutePath;
};
