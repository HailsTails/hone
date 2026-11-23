import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RunnerFailure } from "../../../domain/runner/runner-failure.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { ProjectionRequest } from "../engine/runner-module.ts";
import type { FileRemovalPort } from "../file-system/file-removal-port.ts";
import type { FileTextPort } from "../file-system/file-text-port.ts";
import type { ModuleExtension } from "../host/module-extension.ts";
import type { ModuleLoaderPort } from "../host/module-loader-port.ts";
import type { PathPort } from "../host/path-port.ts";

export type VersionOneProjectionCurrency = {
  readonly file: RepoPath;
  readonly state: "current" | "missing" | "out-of-date";
};

export type VersionOneProjectionInspection = {
  readonly files: readonly VersionOneProjectionCurrency[];
  readonly ruleIds: ReadonlyMap<string, string>;
};

export type VersionOneProjectionPort = {
  readonly inspect: (
    request: ProjectionRequest,
  ) => Promise<Result<VersionOneProjectionInspection, RunnerFailure>>;
  readonly prepare: (
    request: ProjectionRequest,
  ) => Promise<Result<readonly ProjectionWrite[], RunnerFailure>>;
};

export type VersionOneProjectionPlatform = {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly moduleExtension: ModuleExtension;
};

export type VersionOneProjectionPortOf = (
  options: VersionOneProjectionPlatform & {
    readonly installRoot: AbsolutePath;
    readonly modules: ModuleLoaderPort;
  },
) => VersionOneProjectionPort;
