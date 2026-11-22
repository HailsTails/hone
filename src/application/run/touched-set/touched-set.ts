import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { BaseRevisionAvailability } from "../../../domain/repository/base-revision-availability.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import type { GitPort } from "../../ports/git-port.ts";

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
    return {
      measured: "no",
      base: baseRevisionAvailabilityOf({ revision: request.baseRevision, failure: changed.error }),
    };
  }
  return { measured: "yes", paths: new Set(changed.value) };
};
