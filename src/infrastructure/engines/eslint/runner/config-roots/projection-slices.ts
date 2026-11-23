import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { UnprojectedFolderReport } from "../../../../../domain/runner/mechanism-run.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { PROJECTION_PATH } from "../projection/projection-text.ts";
import { configuredDirectoriesOf } from "./checks-config-roots.ts";
import { directoryOf, fileNameOf } from "./checks-paths.ts";

export type ConfigRoot =
  | { readonly placement: "repository" }
  | { readonly placement: "package"; readonly directory: RepoPath };

const SELECTION_FILE_NAME = "disciplines.json";

const REPOSITORY_ROOT: ConfigRoot = { placement: "repository" };

const within = (request: {
  readonly path: string;
  readonly directory: string;
}): "within" | "outside" =>
  request.path === request.directory || request.path.startsWith(`${request.directory}/`)
    ? "within"
    : "outside";

const nestedRepositories = (request: {
  readonly trackedPaths: readonly RepoPath[];
}): readonly string[] =>
  request.trackedPaths
    .filter((path) => fileNameOf({ path }) === SELECTION_FILE_NAME)
    .map((path) => directoryOf({ path }))
    .filter((directory) => directory !== "");

const insideNestedRepository = (request: {
  readonly directory: string;
  readonly nested: readonly string[];
}): "nested" | "own" =>
  request.nested.some(
    (nested) => within({ path: request.directory, directory: nested }) === "within",
  )
    ? "nested"
    : "own";

const codeUnitOrder = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
};

type RootsRequest = {
  readonly trackedPaths: readonly RepoPath[];
  readonly declared: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
};

const packageDirectories = (request: RootsRequest): readonly RepoPath[] => {
  const nested = nestedRepositories(request);
  const configured = configuredDirectoriesOf(request);
  return [...new Set([...configured, ...request.declared])]
    .filter((directory) => directory !== "")
    .filter((directory) => insideNestedRepository({ directory, nested }) === "own")
    .sort(codeUnitOrder)
    .map((directory) => repoPathSchema.parse(directory));
};

export const configRootsOf = (request: RootsRequest): readonly ConfigRoot[] => [
  REPOSITORY_ROOT,
  ...packageDirectories(request).map((directory): ConfigRoot => ({
    placement: "package",
    directory,
  })),
];

export const slicePathOf = (request: { readonly root: ConfigRoot }): RepoPath =>
  request.root.placement === "repository"
    ? PROJECTION_PATH
    : repoPathSchema.parse(`${request.root.directory}/${PROJECTION_PATH}`);

const packageRecord = (request: {
  readonly record: ExceptionRecord;
  readonly directory: RepoPath;
}): readonly ExceptionRecord[] => {
  const record = request.record;
  if (record.kind === "clause-wide-carve-out") {
    return [record];
  }
  return within({ path: record.file, directory: request.directory }) === "within"
    ? [{ ...record, file: repoPathSchema.parse(record.file.slice(request.directory.length + 1)) }]
    : [];
};

export const sliceRecordsOf = (request: {
  readonly root: ConfigRoot;
  readonly records: readonly ExceptionRecord[];
}): readonly ExceptionRecord[] => {
  const root = request.root;
  return root.placement === "repository"
    ? request.records
    : request.records.flatMap((record) => packageRecord({ record, directory: root.directory }));
};

export const packageFoldersOf = (request: {
  readonly roots: readonly ConfigRoot[];
}): ReadonlySet<string> =>
  new Set(request.roots.flatMap((root) => (root.placement === "package" ? [root.directory] : [])));

export const governingPackageOf = (request: {
  readonly file: RepoPath;
  readonly packages: ReadonlySet<string>;
}): string | undefined => {
  const folders = request.file.split("/").slice(0, -1);
  return folders
    .map((_, index) => folders.slice(0, folders.length - index).join("/"))
    .find((folder) => request.packages.has(folder));
};

const outermostOf = (request: { readonly nested: readonly string[] }): readonly string[] =>
  request.nested.filter(
    (folder) =>
      !request.nested.some(
        (other) => other !== folder && within({ path: folder, directory: other }) === "within",
      ),
  );

const holdingOf = (request: {
  readonly paths: readonly string[];
  readonly folder: string;
}): "holds" | "holds-none" =>
  request.paths.some((path) => within({ path, directory: request.folder }) === "within")
    ? "holds"
    : "holds-none";

export const nestedConfigurationFoldersOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly files: readonly RepoPath[];
}): readonly RepoPath[] =>
  outermostOf({ nested: nestedRepositories(request) })
    .filter((folder) => holdingOf({ paths: request.files, folder }) === "holds")
    .sort(codeUnitOrder)
    .map((folder) => repoPathSchema.parse(folder));

export const nestedFilesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly files: readonly RepoPath[];
}): readonly RepoPath[] => {
  const nested = nestedRepositories(request);
  return request.files.filter(
    (file) =>
      insideNestedRepository({ directory: directoryOf({ path: file }), nested }) === "nested",
  );
};

export const unprojectedFoldersOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly loadedConfigs: readonly RepoPath[];
}): readonly UnprojectedFolderReport[] => {
  const nested = nestedRepositories(request);
  const outermostNested = outermostOf({ nested });
  const ownConfigured = [
    ...new Set(request.loadedConfigs.map((path) => directoryOf({ path }))),
  ].filter(
    (directory) => directory !== "" && insideNestedRepository({ directory, nested }) === "nested",
  );
  return [...outermostOf({ nested: ownConfigured })].sort(codeUnitOrder).flatMap((folder) => {
    const selectionFolder = outermostNested.find(
      (candidate) => within({ path: folder, directory: candidate }) === "within",
    );
    return selectionFolder === undefined
      ? []
      : [
          {
            folder: repoPathSchema.parse(folder),
            selectionFolder: repoPathSchema.parse(selectionFolder),
          },
        ];
  });
};

export const orphanedSliceDirectoriesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly roots: readonly ConfigRoot[];
}): readonly RepoPath[] => {
  const nested = nestedRepositories(request);
  const rooted = new Set<string>(
    request.roots.flatMap((root) => (root.placement === "package" ? [root.directory] : [])),
  );
  return request.trackedPaths
    .filter((path) => fileNameOf({ path }) === PROJECTION_PATH)
    .map((path) => directoryOf({ path }))
    .filter((directory) => directory !== "" && !rooted.has(directory))
    .filter((directory) => insideNestedRepository({ directory, nested }) === "own")
    .sort(codeUnitOrder)
    .map((directory) => repoPathSchema.parse(directory));
};
