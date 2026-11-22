import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import { directoryOf, fileNameOf } from "./checks-paths.ts";
import { CONFIG_FILE_NAMES } from "./config-lookup.ts";

type ConfigFilesRequest = {
  readonly trackedPaths: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
};

const configFilesOf = (request: ConfigFilesRequest): readonly RepoPath[] =>
  request.lookup === "nearest-to-file"
    ? request.trackedPaths.filter((path) => CONFIG_FILE_NAMES.includes(fileNameOf({ path })))
    : [];

const placementOf = (request: {
  readonly path: RepoPath;
  readonly folders: readonly string[];
}): "inside" | "outside" =>
  request.folders.some((folder) => request.path.startsWith(`${folder}/`)) ? "inside" : "outside";

export const outsideNestedRepositories = (request: {
  readonly directories: readonly string[];
  readonly nestedRepositories: readonly string[];
}): readonly string[] =>
  request.directories.filter(
    (directory) =>
      !request.nestedRepositories.some(
        (folder) => directory === folder || directory.startsWith(`${folder}/`),
      ),
  );

export const configuredDirectoriesOf = (request: ConfigFilesRequest): readonly string[] =>
  configFilesOf(request).map((path) => directoryOf({ path }));

export const packageConfigFilesOf = (
  request: ConfigFilesRequest & { readonly nestedRepositories: readonly string[] },
): readonly RepoPath[] =>
  configFilesOf(request).filter(
    (path) =>
      directoryOf({ path }) !== "" &&
      placementOf({ path, folders: request.nestedRepositories }) === "outside",
  );
