import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { type TouchedSet, withoutPureMoves } from "../../../domain/repository/touched-set.ts";
import type { ForfeitureAssessment } from "../../../domain/settings/assessment.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { baseRevisionAvailabilityOf, computeTouchedSet } from "./touched-set.ts";

const touchedBeyondPureMoves = (request: {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince" | "renamedSince">;
}): TouchedSet => {
  const touched = computeTouchedSet(request);
  if (touched.measured !== "yes" || request.baseRevision === undefined) {
    return touched;
  }
  const renamed = request.git.renamedSince({
    repoRoot: request.repoRoot,
    baseRevision: request.baseRevision,
  });
  return renamed.outcome === "failed"
    ? {
        measured: "no",
        base: baseRevisionAvailabilityOf({
          revision: request.baseRevision,
          failure: renamed.error,
        }),
      }
    : withoutPureMoves({ touched, renamed: renamed.value });
};

export const touchedSetUnder = (request: {
  readonly forfeiture: ForfeitureAssessment;
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince" | "renamedSince">;
}): TouchedSet =>
  request.forfeiture === "elsewhere" ? { measured: "elsewhere" } : touchedBeyondPureMoves(request);
