import type { GitFailure, GitPort } from "../../../infrastructure/git/git-port.ts";
import type { AbsolutePath } from "../../../infrastructure/content-files/absolute-path.ts";
import type { BaseRevisionAvailability } from "../../../domain/repository/base-revision-availability.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";

export type TouchedSet =
  | { readonly measured: "yes"; readonly paths: ReadonlySet<RepoPath> }
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability }
  | { readonly measured: "elsewhere" };

export type BaseJudgement = "in-this-run" | "left-to-another-run";

export const baseJudgementOf = (request: { readonly touched: TouchedSet }): BaseJudgement =>
  request.touched.measured === "elsewhere" ? "left-to-another-run" : "in-this-run";

const firstLineOf = (request: { readonly failure: GitFailure }): string =>
  request.failure.detail
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

export const baseRevisionAvailabilityOf = (request: {
  readonly revision: string;
  readonly failure: GitFailure;
}): BaseRevisionAvailability => ({
  state: "git-failed",
  revision: request.revision,
  gitMessage: firstLineOf({ failure: request.failure }),
});

export const computeTouchedSet = (request: {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
}): TouchedSet => {
  if (request.baseRevision === undefined) {
    return { measured: "no", base: { state: "not-given" } };
  }
  const changed = request.git.changedSince({
    repoRoot: request.repoRoot,
    baseRevision: request.baseRevision,
  });
  if (changed.outcome === "failed") {
    return { measured: "no", base: baseRevisionAvailabilityOf({ revision: request.baseRevision, failure: changed.error }) };
  }
  return { measured: "yes", paths: new Set(changed.value) };
};
