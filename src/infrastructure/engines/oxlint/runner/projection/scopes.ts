import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { isRepoPath } from "../../../../../domain/repository/repo-path.ts";

export const OXLINT_PROJECTION = "hone.oxlint.json";

const CONFIG_FILENAMES = [
  ".oxlintrc.json",
  ".oxlintrc.jsonc",
  "oxlint.config.ts",
  "oxlint.config.mts",
];

export const createProjectionPath = (folder: string): RepoPath => {
  const file = folder === "" ? OXLINT_PROJECTION : `${folder}/${OXLINT_PROJECTION}`;
  if (!isRepoPath(file)) throw new Error(`Invalid Oxlint projection path ${file}`);
  return file;
};

export type ProjectionScope = {
  readonly folder: string;
  readonly config: RepoPath | undefined;
  readonly file: RepoPath;
  readonly files: readonly RepoPath[];
};

export const createProjectionScopes = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly files: readonly RepoPath[];
}): readonly ProjectionScope[] => {
  const configs = request.trackedPaths.filter((file) =>
    CONFIG_FILENAMES.includes(file.slice(file.lastIndexOf("/") + 1)),
  );
  const configsByFolder = Map.groupBy(configs, (file) =>
    file.slice(0, Math.max(0, file.lastIndexOf("/"))),
  );
  const folders = [...configsByFolder.keys()].toSorted((left, right) => right.length - left.length);
  const filesByFolder = Map.groupBy(
    request.files,
    (file) => folders.find((folder) => folder === "" || file.startsWith(`${folder}/`)) ?? "",
  );
  const projectedFolders = request.trackedPaths.flatMap((file) =>
    file.slice(file.lastIndexOf("/") + 1) === OXLINT_PROJECTION
      ? [file.slice(0, Math.max(0, file.lastIndexOf("/")))]
      : [],
  );
  const scopes = new Set([...folders, ...filesByFolder.keys(), ...projectedFolders]);
  return [...scopes].toSorted().map((folder) => {
    const [config, duplicate] = configsByFolder.get(folder) ?? [];
    if (duplicate !== undefined)
      throw new Error(`More than one Oxlint config governs ${folder || "."}`);
    return {
      folder,
      config,
      file: createProjectionPath(folder),
      files: filesByFolder.get(folder) ?? [],
    };
  });
};

const createCandidatePaths = (file: RepoPath): readonly string[] => {
  const segments = file.split("/");
  return segments.flatMap((_, depth) => {
    const prefix = segments.slice(0, depth).join("/");
    return CONFIG_FILENAMES.map((name) => (prefix === "" ? name : `${prefix}/${name}`));
  });
};

export const findUntrackedConfig = (request: {
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly exists: (file: string) => "present" | "absent";
}): string | undefined => {
  const tracked = new Set<string>(request.trackedPaths);
  const candidates = new Set(request.files.flatMap(createCandidatePaths));
  return [...candidates].find((file) => !tracked.has(file) && request.exists(file) === "present");
};
