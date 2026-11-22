import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";

export type DebtForfeiture = "forfeits" | "keeps";

export const debtForfeitureAt = (request: {
  readonly touched: TouchedSet;
  readonly file: RepoPath;
}): DebtForfeiture =>
  request.touched.measured === "yes" && request.touched.paths.has(request.file)
    ? "forfeits"
    : "keeps";
