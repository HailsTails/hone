import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CurrentProjection } from "./projection.ts";

export type ProjectionStates = ReadonlyMap<RepoPath, CurrentProjection>;

export const projectionStateAt = (request: {
  readonly states: ProjectionStates;
  readonly file: RepoPath;
}): Result<CurrentProjection, RunnerFailure> => {
  const current = request.states.get(request.file);
  return current === undefined
    ? { outcome: "failed", error: { kind: "tool-failed", detail: `the projection at ${request.file} was not read` } }
    : { outcome: "ok", value: current };
};
