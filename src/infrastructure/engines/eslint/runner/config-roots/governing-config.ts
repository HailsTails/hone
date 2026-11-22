import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type {
  ConfigFileSearch,
  EslintPort,
  IgnoredState,
  QueryInstance,
} from "../toolchain/eslint-instance.ts";

export type GoverningConfig = { readonly configFile: string; readonly folder: AbsolutePath };

export type IgnoreTarget = { readonly kind: "file" | "folder"; readonly path: RepoPath };

export type GoverningIgnore = "ignored" | "not-ignored" | "unanswered";

export type GoverningIgnoreQuestion = {
  readonly governing: GoverningConfig;
  readonly target: IgnoreTarget;
};

export type GoverningIgnores = (question: GoverningIgnoreQuestion) => Promise<GoverningIgnore>;

export type GoverningVerdict = "ignored-by-governing-config" | "not-ignored";

export type GoverningLookup = {
  readonly query: QueryInstance;
  readonly governingIgnoreOf: GoverningIgnores;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
};

type PlacedGoverningConfig = GoverningConfig & {
  readonly repositoryFolder: RepoPath | "repository-root";
};

const REPOSITORY_ROOT_FOLDER = ".";

const FOLDER_PROBE_NAME = "hone-folder-probe";

const askedPathOf = (request: { readonly target: IgnoreTarget }): string =>
  request.target.kind === "file"
    ? request.target.path
    : `${request.target.path}/${FOLDER_PROBE_NAME}`;

const governingIgnoreOf = (request: {
  readonly state: Result<IgnoredState, RunnerFailure>;
}): GoverningIgnore => {
  if (request.state.outcome === "failed") {
    return "unanswered";
  }
  return request.state.value === "ignored" ? "ignored" : "not-ignored";
};

export const governingConfigIgnores = (
  request: GoverningIgnoreQuestion & { readonly eslint: EslintPort },
): Promise<GoverningIgnore> =>
  request.eslint
    .ignoredByConfig({
      configFile: request.governing.configFile,
      cwd: request.governing.folder,
      path: askedPathOf({ target: request.target }),
    })
    .then((state) => governingIgnoreOf({ state }));

export const cachedGoverningIgnores = (request: {
  readonly eslint: EslintPort;
}): GoverningIgnores => {
  const answered = new Map<string, Promise<GoverningIgnore>>();
  return (question) => {
    const key = `${question.governing.configFile}\n${askedPathOf({ target: question.target })}`;
    const known = answered.get(key);
    if (known !== undefined) {
      return known;
    }
    const answer = governingConfigIgnores({ ...question, eslint: request.eslint });
    answered.set(key, answer);
    return answer;
  };
};

const repositoryFolderOf = (request: {
  readonly folder: string;
}): RepoPath | "repository-root" | "outside-repository" => {
  if (request.folder === REPOSITORY_ROOT_FOLDER) {
    return "repository-root";
  }
  const parsed = repoPathSchema.safeParse(request.folder);
  return parsed.success ? parsed.data : "outside-repository";
};

const boundaryPlacement = (request: {
  readonly repositoryFolder: RepoPath | "repository-root";
  readonly boundary: RepoPath;
}): "above-boundary" | "not-above-boundary" =>
  request.repositoryFolder === "repository-root" ||
  request.boundary.startsWith(`${request.repositoryFolder}/`)
    ? "above-boundary"
    : "not-above-boundary";

const placedGoverningConfig = (request: {
  readonly lookup: GoverningLookup;
  readonly search: ConfigFileSearch;
  readonly boundary: RepoPath;
}): PlacedGoverningConfig | undefined => {
  if (request.search.kind !== "found") {
    return undefined;
  }
  const placed = request.lookup.path.relative({
    from: request.lookup.repoRoot,
    to: request.search.path,
  });
  if (placed.relation === "different-root") {
    return undefined;
  }
  const repositoryFolder = repositoryFolderOf({
    folder: request.lookup.path.repositoryDirectoryOf({ path: placed.path }),
  });
  const folder = request.lookup.path.resolve({
    path: request.lookup.path.directoryOf({ path: request.search.path }),
  });
  if (repositoryFolder === "outside-repository" || folder.outcome === "failed") {
    return undefined;
  }
  return boundaryPlacement({ repositoryFolder, boundary: request.boundary }) === "above-boundary"
    ? { configFile: request.search.path, folder: folder.value, repositoryFolder }
    : undefined;
};

const targetOf = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: GoverningConfig;
  readonly kind: IgnoreTarget["kind"];
  readonly path: RepoPath;
}): IgnoreTarget | undefined => {
  const placed = request.lookup.path.relative({
    from: request.governing.folder,
    to: request.lookup.path.join({ segments: [request.lookup.repoRoot, request.path] }),
  });
  if (placed.relation === "different-root") {
    return undefined;
  }
  const parsed = repoPathSchema.safeParse(placed.path);
  return parsed.success ? { kind: request.kind, path: parsed.data } : undefined;
};

const verdictAbove = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: PlacedGoverningConfig;
  readonly file: RepoPath;
}): Promise<GoverningVerdict> =>
  request.governing.repositoryFolder === "repository-root"
    ? Promise.resolve("not-ignored")
    : governingVerdict({
        lookup: request.lookup,
        boundary: request.governing.repositoryFolder,
        file: request.file,
      });

const fileVerdict = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: PlacedGoverningConfig;
  readonly file: RepoPath;
}): Promise<GoverningVerdict> => {
  const target = targetOf({ ...request, kind: "file", path: request.file });
  if (target === undefined) {
    return Promise.resolve("not-ignored");
  }
  return request.lookup
    .governingIgnoreOf({
      governing: { configFile: request.governing.configFile, folder: request.governing.folder },
      target,
    })
    .then((answer): GoverningVerdict =>
      answer === "ignored" ? "ignored-by-governing-config" : "not-ignored",
    );
};

const verdictOfGoverning = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: PlacedGoverningConfig;
  readonly boundary: RepoPath;
  readonly file: RepoPath;
}): Promise<GoverningVerdict> => {
  const target = targetOf({ ...request, kind: "folder", path: request.boundary });
  if (target === undefined) {
    return Promise.resolve("not-ignored");
  }
  return request.lookup
    .governingIgnoreOf({
      governing: { configFile: request.governing.configFile, folder: request.governing.folder },
      target,
    })
    .then((answer): Promise<GoverningVerdict> =>
      answer === "ignored" ? fileVerdict(request) : verdictAbove(request),
    );
};

const governingVerdict = (request: {
  readonly lookup: GoverningLookup;
  readonly boundary: RepoPath;
  readonly file: RepoPath;
}): Promise<GoverningVerdict> =>
  request.lookup.query
    .configFileOf({ file: request.boundary })
    .then((search): GoverningVerdict | Promise<GoverningVerdict> => {
      const governing = placedGoverningConfig({
        lookup: request.lookup,
        search,
        boundary: request.boundary,
      });
      return governing === undefined
        ? "not-ignored"
        : verdictOfGoverning({ ...request, governing });
    });

export const brokenConfigVerdict = (request: {
  readonly lookup: GoverningLookup;
  readonly brokenConfig: string;
  readonly file: RepoPath;
}): Promise<GoverningVerdict> => {
  const placed = request.lookup.path.relative({
    from: request.lookup.repoRoot,
    to: request.brokenConfig,
  });
  if (placed.relation === "different-root") {
    return Promise.resolve("not-ignored");
  }
  const boundary = repositoryFolderOf({
    folder: request.lookup.path.repositoryDirectoryOf({ path: placed.path }),
  });
  return boundary === "repository-root" || boundary === "outside-repository"
    ? Promise.resolve("not-ignored")
    : governingVerdict({ lookup: request.lookup, boundary, file: request.file });
};
