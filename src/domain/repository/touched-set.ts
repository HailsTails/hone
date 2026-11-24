import type { BaseRevisionAvailability } from "./base-revision-availability.ts";
import type { RenamedPaths } from "./renamed-path.ts";
import type { RepoPath } from "./repo-path-types.ts";

export type TouchedSet =
  | { readonly measured: "yes"; readonly paths: ReadonlySet<RepoPath> }
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability }
  | { readonly measured: "elsewhere" };

export type BaseJudgement = "in-this-run" | "left-to-another-run";

export const baseJudgementOf = (request: { readonly touched: TouchedSet }): BaseJudgement =>
  request.touched.measured === "elsewhere" ? "left-to-another-run" : "in-this-run";

export const withoutPureMoves = (request: {
  readonly touched: TouchedSet;
  readonly renamed: RenamedPaths;
}): TouchedSet =>
  request.touched.measured === "yes"
    ? {
        measured: "yes",
        paths: new Set(
          [...request.touched.paths].filter(
            (path) => request.renamed.get(path)?.content !== "unchanged",
          ),
        ),
      }
    : request.touched;
