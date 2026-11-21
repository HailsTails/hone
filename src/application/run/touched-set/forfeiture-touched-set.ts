import type { GitPort } from "../../ports/git-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { ForfeitureAssessment } from "../../../domain/settings/assessment.ts";
import { computeTouchedSet } from "./touched-set.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";

export const touchedSetUnder = (request: {
  readonly forfeiture: ForfeitureAssessment;
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
}): TouchedSet => (request.forfeiture === "elsewhere" ? { measured: "elsewhere" } : computeTouchedSet(request));
