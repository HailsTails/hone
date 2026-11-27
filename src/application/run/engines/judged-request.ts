import { excludeProjectionOutputs } from "../../../domain/repository/projection-outputs.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { NamedEngineRunRequest } from "../../ports/engine/engine-run.ts";

type JudgedPaths = Pick<NamedEngineRunRequest, "files" | "trackedPaths">;

export const mapRequestToJudgedRequest = <Request extends JudgedPaths>(request: {
  readonly engineRequest: Request;
  readonly outputs: readonly RepoPath[];
}): Request => {
  const outputs = new Set(request.outputs);
  return {
    ...request.engineRequest,
    files: excludeProjectionOutputs({ files: request.engineRequest.files, outputs }),
    trackedPaths: excludeProjectionOutputs({ files: request.engineRequest.trackedPaths, outputs }),
  };
};
