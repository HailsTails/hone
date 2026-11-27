import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RenamedSinceBase } from "../../../domain/repository/renamed-path.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import type { GitPort } from "../../ports/git-port.ts";
import { touchedSetUnder } from "./forfeiture-touched-set.ts";

export type TouchedMeasuring = "when-debt-held" | "always";

export type TouchedScope =
  | { readonly baseScope: "merge-base"; readonly measuring: TouchedMeasuring }
  | { readonly baseScope: "pinned-ancestor" | "elsewhere" };

const NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const holdsDebt = (request: {
  readonly records: readonly PlacedRecord[];
}): "holds-debt" | "holds-none" =>
  request.records.some((placed) => placed.record.kind === "debt") ? "holds-debt" : "holds-none";

export const touchedSetOf = (request: {
  readonly scope: TouchedScope;
  readonly records: readonly PlacedRecord[];
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
  readonly renamed: RenamedSinceBase;
}): TouchedSet => {
  const { scope } = request;
  if (
    scope.baseScope === "merge-base" &&
    scope.measuring === "when-debt-held" &&
    holdsDebt(request) === "holds-none"
  ) {
    return NOTHING_TOUCHED;
  }
  return touchedSetUnder({
    repoRoot: request.repoRoot,
    baseRevision: request.baseRevision,
    git: request.git,
    renamed: request.renamed,
    baseScope: scope.baseScope,
  });
};
