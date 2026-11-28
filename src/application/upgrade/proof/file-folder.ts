import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { directoryOf } from "../writing/relative-specifier.ts";

const PATH_SEPARATOR = "/";

export const mapFileToFolder = (request: { readonly file: RepoPath }): string =>
  directoryOf({ file: request.file }).join(PATH_SEPARATOR);
