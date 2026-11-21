import type { GitPort } from "../../../infrastructure/git/git-port.ts";
import type { AbsolutePath } from "../../../infrastructure/content-files/absolute-path.ts";
import type { ForfeitureAssessment } from "../../../infrastructure/hone-config-file/assessment.ts";
import { computeTouchedSet, type TouchedSet } from "./touched-set.ts";

export const touchedSetUnder = (request: {
  readonly forfeiture: ForfeitureAssessment;
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
}): TouchedSet => (request.forfeiture === "elsewhere" ? { measured: "elsewhere" } : computeTouchedSet(request));
