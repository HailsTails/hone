import type { FileRemovalPort } from "../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import { applyProjectionEntries } from "../../application/projection/apply-projection-entries.ts";
import { versionTwoProjectionOver } from "../../application/projection/version-two-projection.ts";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ProjectionWrite } from "../../domain/runner/runner-result-types.ts";

export type VersionTwoProjectInput = {
  readonly stages: VersionTwoStages;
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
};

export const versionTwoProjectedOf = async (
  request: VersionTwoProjectInput,
): Promise<Result<readonly ProjectionWrite[], RunLoadFailure>> => {
  const projected = await versionTwoProjectionOver({ stages: request.stages });
  return projected.outcome === "failed"
    ? projected
    : applyProjectionEntries({
        fileText: request.fileText,
        fileRemoval: request.fileRemoval,
        path: request.path,
        repoRoot: request.repoRoot,
        files: projected.value,
      });
};
