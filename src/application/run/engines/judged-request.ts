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
    files: request.engineRequest.files.filter((file) => !outputs.has(file)),
    trackedPaths: request.engineRequest.trackedPaths.filter((file) => !outputs.has(file)),
  };
};
