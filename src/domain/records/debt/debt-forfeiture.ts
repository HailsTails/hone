import type { TouchedSet } from "../../../application/run/touched-set/touched-set.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";

export type DebtForfeiture = "forfeits" | "keeps";

export const debtForfeitureAt = (request: { readonly touched: TouchedSet; readonly file: RepoPath }): DebtForfeiture =>
  request.touched.measured === "yes" && request.touched.paths.has(request.file) ? "forfeits" : "keeps";
