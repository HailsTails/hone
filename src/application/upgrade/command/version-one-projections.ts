import type { CheckRequest } from "../../run/check/run-check.ts";
import type { ProjectRequest } from "../../projection/run-project.ts";
import { loadFailureDetail } from "../../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../../../infrastructure/node/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { teamConfigsOf } from "../proof/team-config-finder.ts";
import { type VersionOneProjectionsOf, versionOneProjectionsOver } from "../proof/version-one-projections-reading.ts";

export type VersionOneProject = (request: ProjectRequest) => Promise<Result<readonly ProjectionWrite[], LoadFailure>>;

export type VersionOneProjectionsRequest = {
  readonly project: VersionOneProject;
  readonly check: CheckRequest;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

export const versionOneProjectionsOfRepository = (request: VersionOneProjectionsRequest): VersionOneProjectionsOf =>
  versionOneProjectionsOver({
    project: async () => {
      const projected = await request.project({ ...request.check, fileText: request.fileText });
      return projected.outcome === "failed" ? { outcome: "failed", error: { detail: loadFailureDetail({ failure: projected.error }) } } : projected;
    },
    teamConfigsOf: ({ projections }) =>
      teamConfigsOf({ repoRoot: request.repoRoot, fileText: request.fileText, path: request.path, trackedPaths: request.trackedPaths, projections }),
  });
