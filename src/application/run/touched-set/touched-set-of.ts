import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RenamedSinceBase } from "../../../domain/repository/renamed-path.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import type { Assessment } from "../../../domain/settings/assessment.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { touchedSetUnder } from "./forfeiture-touched-set.ts";

export type TouchedMeasuring = "when-debt-held" | "always";

const NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const holdsDebt = (request: {
  readonly records: readonly PlacedRecord[];
}): "holds-debt" | "holds-none" =>
  request.records.some((placed) => placed.record.kind === "debt") ? "holds-debt" : "holds-none";

const measurementOf = (request: {
  readonly measuring: TouchedMeasuring;
  readonly records: readonly PlacedRecord[];
}): "needed" | "not-needed" =>
  request.measuring === "always" || holdsDebt(request) === "holds-debt" ? "needed" : "not-needed";

export const touchedSetOf = (request: {
  readonly assessment: Assessment;
  readonly measuring: TouchedMeasuring;
  readonly records: readonly PlacedRecord[];
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
  readonly renamed: RenamedSinceBase;
}): TouchedSet => {
  if (request.assessment.forfeiture !== "elsewhere" && measurementOf(request) === "not-needed") {
    return NOTHING_TOUCHED;
  }
  return touchedSetUnder({
    forfeiture: request.assessment.forfeiture,
    repoRoot: request.repoRoot,
    baseRevision: request.baseRevision,
    git: request.git,
    renamed: request.renamed,
  });
};
