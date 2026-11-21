import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { FileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import { parsedJson } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import {
  type ConfigLookup,
  configLookupDeclaring,
  type FolderConfiguration,
  folderConfigurationOf,
  teamConfigLookupFor,
} from "../config-roots/config-lookup.ts";
import { selectionLookupSchema } from "../native-exceptions/eslint-file-schemas.ts";
import { type ChecksRepository, checksRepositoryOver } from "../checks-runner/checks-repository.ts";

const VERSION_ONE_SETTINGS_FILE = "disciplines.json";

type VersionOneLookupRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

const declaredLookup = (request: VersionOneLookupRequest): EslintConfigLookup | undefined => {
  const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, VERSION_ONE_SETTINGS_FILE] }) });
  const json = text.outcome === "ok" ? parsedJson({ text: text.value }) : undefined;
  const parsed = json?.outcome === "ok" ? selectionLookupSchema.safeParse(json.value) : undefined;
  return parsed?.success ? parsed.data.eslintConfigLookup : undefined;
};

const versionOneConfigLookup = (request: VersionOneLookupRequest): EslintConfigLookup =>
  configLookupDeclaring({ ...request, declared: declaredLookup(request) });

const versionOneTeamConfigLookup = (request: VersionOneLookupRequest): Result<ConfigLookup, RunnerFailure> =>
  teamConfigLookupFor({ ...request, lookup: versionOneConfigLookup(request), settingsFile: VERSION_ONE_SETTINGS_FILE });

export type TrackedPathsRequest = { readonly trackedPaths: readonly RepoPath[] };

export type EslintRepository = ChecksRepository & {
  readonly configLookup: (request: TrackedPathsRequest) => EslintConfigLookup;
  readonly teamConfigLookup: (request: TrackedPathsRequest) => Result<ConfigLookup, RunnerFailure>;
  readonly folderConfiguration: (request: { readonly folder: RepoPath }) => FolderConfiguration;
};

export const eslintRepositoryOver = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): EslintRepository => ({
  ...checksRepositoryOver(request),
  configLookup: ({ trackedPaths }) => versionOneConfigLookup({ ...request, trackedPaths }),
  teamConfigLookup: ({ trackedPaths }) => versionOneTeamConfigLookup({ ...request, trackedPaths }),
  folderConfiguration: ({ folder }) => folderConfigurationOf({ ...request, folder }),
});
