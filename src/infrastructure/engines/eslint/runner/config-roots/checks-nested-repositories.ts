import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { directoryOf, fileNameOf } from "./checks-paths.ts";

export const SETTINGS_FILE_NAME = "hone.config.json";

const holdingOf = (request: { readonly files: readonly RepoPath[]; readonly folder: string }): "holds" | "holds-none" =>
  request.files.some((file) => file.startsWith(`${request.folder}/`)) ? "holds" : "holds-none";

export const nestedVersionTwoFoldersOf = (request: { readonly trackedPaths: readonly RepoPath[] }): readonly string[] =>
  request.trackedPaths
    .filter((path) => fileNameOf({ path }) === SETTINGS_FILE_NAME)
    .map((path) => directoryOf({ path }))
    .filter((folder) => folder !== "");

export const nestedVersionTwoRepositoriesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly files: readonly RepoPath[];
}): readonly string[] => nestedVersionTwoFoldersOf(request).filter((folder) => holdingOf({ files: request.files, folder }) === "holds");
