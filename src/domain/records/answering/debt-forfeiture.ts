import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";

export type DebtForfeiture = "forfeits" | "keeps";

export const debtForfeitureAt = (request: {
  readonly touched: TouchedSet;
  readonly file: RepoPath;
}): DebtForfeiture => {
  const { touched, file } = request;
  if (touched.measured === "no" || touched.measured === "elsewhere") return "keeps";
  return touched.paths.has(file) ? "forfeits" : "keeps";
};
