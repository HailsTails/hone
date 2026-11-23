import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import { teamConfigsOf } from "../proof/team-config-finder.ts";
import {
  type VersionOneProjectionsOf,
  versionOneProjectionsOver,
} from "../proof/version-one-projections-reading.ts";

export type VersionOneProject = () => Promise<Result<readonly ProjectionWrite[], LoadFailure>>;

export type VersionOneProjectionsRequest = {
  readonly project: VersionOneProject;
  readonly loadFailureDetail: LoadFailureDetail;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

export const versionOneProjectionsOfRepository = (
  request: VersionOneProjectionsRequest,
): VersionOneProjectionsOf =>
  versionOneProjectionsOver({
    project: async () => {
      const projected = await request.project();
      return projected.outcome === "failed"
        ? {
            outcome: "failed",
            error: { detail: request.loadFailureDetail({ failure: projected.error }) },
          }
        : projected;
    },
    teamConfigsOf: ({ projections }) =>
      teamConfigsOf({
        repoRoot: request.repoRoot,
        fileText: request.fileText,
        path: request.path,
        trackedPaths: request.trackedPaths,
        projections,
      }),
  });
