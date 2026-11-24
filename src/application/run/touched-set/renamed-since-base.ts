import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RenamedSinceBase } from "../../../domain/repository/renamed-path.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { baseRevisionAvailabilityOf } from "./touched-set.ts";

export const renamedSinceBaseOf = (request: {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "renamedSince">;
}): RenamedSinceBase => {
  const { baseRevision } = request;
  if (baseRevision === undefined) {
    return { measured: "no", base: { state: "not-given" } };
  }
  const renamed = request.git.renamedSince({ repoRoot: request.repoRoot, baseRevision });
  return renamed.outcome === "failed"
    ? {
        measured: "no",
        base: baseRevisionAvailabilityOf({ revision: baseRevision, failure: renamed.error }),
      }
    : { measured: "yes", renamed: renamed.value };
};
