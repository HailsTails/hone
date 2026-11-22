import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import { moduleExtensionOf } from "../application/ports/host/module-extension.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import { argumentsInvalid } from "../infrastructure/command-line/arguments/argument-problem.ts";
import { installRootOf } from "../infrastructure/command-line/installation/install-root.ts";
import type { ToolPorts } from "./tool-ports.ts";
import type { VersionTwoPorts } from "./version-two-stages.ts";

export type VersionTwoRepositoryPorts = Pick<ToolPorts, keyof VersionTwoPorts | "stagesOver">;

export const repoRootOf = (request: {
  readonly path: PathPort;
  readonly repo: string;
}): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.path.resolve({ path: request.repo });
  return resolved.outcome === "failed"
    ? argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } })
    : resolved;
};

export const repositoryLocatedOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
  readonly repo: string;
}): Result<RepositoryLocated, LoadFailure> => {
  const repoRoot = repoRootOf(request);
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return installRoot.outcome === "failed"
    ? installRoot
    : { outcome: "ok", value: { repoRoot: repoRoot.value, installRoot: installRoot.value } };
};

export const stagesOverRepository = (request: {
  readonly ports: VersionTwoRepositoryPorts;
  readonly moduleUrl: string;
  readonly located: RepositoryLocated;
  readonly baseRevision: string | undefined;
}): VersionTwoStages =>
  request.ports.stagesOver({
    ports: request.ports,
    locations: {
      repoRoot: request.located.repoRoot,
      installRoot: request.located.installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
      baseRevision: request.baseRevision,
    },
  });
