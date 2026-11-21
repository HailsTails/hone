import type { BaseRevisionAvailability } from "./base-revision-availability.ts";
import type { RepoPath } from "./repo-path-types.ts";

export type TouchedSet =
  | { readonly measured: "yes"; readonly paths: ReadonlySet<RepoPath> }
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability }
  | { readonly measured: "elsewhere" };

export type BaseJudgement = "in-this-run" | "left-to-another-run";

export const baseJudgementOf = (request: { readonly touched: TouchedSet }): BaseJudgement =>
  request.touched.measured === "elsewhere" ? "left-to-another-run" : "in-this-run";
