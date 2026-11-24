import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RenamedSinceBase } from "../../../domain/repository/renamed-path.ts";
import { type TouchedSet, withoutPureMoves } from "../../../domain/repository/touched-set.ts";
import type { ForfeitureAssessment } from "../../../domain/settings/assessment.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { computeTouchedSet } from "./touched-set.ts";

type TouchedRequest = {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
  readonly renamed: RenamedSinceBase;
};

const touchedBeyondPureMoves = (request: TouchedRequest): TouchedSet => {
  const touched = computeTouchedSet(request);
  if (touched.measured !== "yes") {
    return touched;
  }
  return request.renamed.measured === "no"
    ? { measured: "no", base: request.renamed.base }
    : withoutPureMoves({ touched, renamed: request.renamed.renamed });
};

export const touchedSetUnder = (
  request: TouchedRequest & { readonly forfeiture: ForfeitureAssessment },
): TouchedSet =>
  request.forfeiture === "elsewhere" ? { measured: "elsewhere" } : touchedBeyondPureMoves(request);
