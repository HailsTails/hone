import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { nestedRepositoryFoldersOf } from "./projection-slices.ts";

export const SETTINGS_FILE_NAME = "hone.config.json";

export const nestedVersionTwoFoldersOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
}): readonly string[] =>
  nestedRepositoryFoldersOf({ ...request, settingsFile: SETTINGS_FILE_NAME });
