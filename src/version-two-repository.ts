import { argumentsInvalid } from "./infrastructure/command-line/arguments/argument-problem.ts";
import { installRootOf } from "./infrastructure/command-line/installation/install-root.ts";
import type { LoadFailure } from "./domain/report/load-failure.ts";
import type { CommandRequest } from "./application/ports/command-request.ts";
import type { AbsolutePath } from "./domain/repository/absolute-path-types.ts";
import { moduleExtensionOf } from "./application/ports/host/module-extension.ts";
import type { Result } from "./domain/result.ts";
import { type VersionTwoLocations, type VersionTwoPorts, versionTwoStagesOver } from "./version-two-stages.ts";
import type { VersionTwoStages } from "./application/run/version-two-run.ts";

export type StagesOver = (request: { readonly ports: VersionTwoPorts; readonly locations: VersionTwoLocations }) => VersionTwoStages;

export type VersionTwoRepositoryPorts = {
  readonly gitTree: VersionTwoPorts["gitTree"];
  readonly directory: VersionTwoPorts["directory"];
  readonly recordsSourceOf: VersionTwoPorts["recordsSourceOf"];
  readonly stagesOver: StagesOver;
};

export const installedStagesOver: StagesOver = versionTwoStagesOver;

export type RepositoryLocated = { readonly repoRoot: AbsolutePath; readonly installRoot: AbsolutePath };

export const repoRootOf = (request: { readonly command: CommandRequest; readonly repo: string }): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.command.path.resolve({ path: request.repo });
  return resolved.outcome === "failed" ? argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } }) : resolved;
};

export const repositoryLocatedOf = (request: { readonly command: CommandRequest; readonly repo: string }): Result<RepositoryLocated, LoadFailure> => {
  const { command } = request;
  const repoRoot = repoRootOf(request);
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: command.path, moduleUrl: command.moduleUrl });
  return installRoot.outcome === "failed" ? installRoot : { outcome: "ok", value: { repoRoot: repoRoot.value, installRoot: installRoot.value } };
};

export const stagesOverRepository = (request: {
  readonly ports: VersionTwoRepositoryPorts;
  readonly command: CommandRequest;
  readonly located: RepositoryLocated;
  readonly baseRevision: string | undefined;
}): VersionTwoStages => {
  const { path, fileText, modules, git } = request.command;
  return request.ports.stagesOver({
    ports: {
      fileText,
      path,
      modules,
      git,
      gitTree: request.ports.gitTree,
      directory: request.ports.directory,
      recordsSourceOf: request.ports.recordsSourceOf,
    },
    locations: {
      repoRoot: request.located.repoRoot,
      installRoot: request.located.installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.command.moduleUrl }),
      baseRevision: request.baseRevision,
    },
  });
};
