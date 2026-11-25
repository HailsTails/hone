import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { TeamConfigRefusal } from "../../ports/upgrade/plan-refusal.ts";
import type { ProofWrites } from "../proof-writes/proof-writes.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";

export type ProjectionsRefusal =
  | { readonly kind: "project-failed"; readonly detail: string }
  | { readonly kind: "team-config-refused"; readonly refusal: TeamConfigRefusal }
  | { readonly kind: "slice-left-in-place"; readonly files: readonly RepoPath[] };

export type VersionOneProjectionsReading = {
  readonly written: ProofWrites;
  readonly removed: readonly RepoPath[];
  readonly outcome: Result<readonly VersionOneProjection[], ProjectionsRefusal>;
};

export type VersionOneProjectionsOf = () => Promise<VersionOneProjectionsReading>;

export type VersionOneProjectionSources = {
  readonly writes: () => ProofWrites;
  readonly project: () => Promise<Result<readonly ProjectionWrite[], { readonly detail: string }>>;
  readonly teamConfigsOf: (request: {
    readonly projections: readonly RepoPath[];
  }) => Result<readonly VersionOneProjection[], TeamConfigRefusal>;
};

type Effect = ProjectionWrite["effect"];

const pathsWith = (request: {
  readonly writes: readonly ProjectionWrite[];
  readonly effect: Effect;
}): readonly RepoPath[] =>
  request.writes.filter((write) => write.effect === request.effect).map((write) => write.path);

const refusedWith = (request: {
  readonly written: ProofWrites;
  readonly removed: readonly RepoPath[];
  readonly refusal: ProjectionsRefusal;
}): VersionOneProjectionsReading => ({
  written: request.written,
  removed: request.removed,
  outcome: { outcome: "failed", error: request.refusal },
});

const readOver = (request: {
  readonly writes: readonly ProjectionWrite[];
  readonly sources: VersionOneProjectionSources;
}): VersionOneProjectionsReading => {
  const written = request.sources.writes();
  const removed = pathsWith({ writes: request.writes, effect: "removed" });
  const stale = pathsWith({ writes: request.writes, effect: "left-in-place" });
  if (stale.length > 0) {
    return refusedWith({
      written,
      removed,
      refusal: { kind: "slice-left-in-place", files: stale },
    });
  }
  const configs = request.sources.teamConfigsOf({
    projections: request.writes.flatMap(({ path, effect }) => (effect === "removed" ? [] : [path])),
  });
  return configs.outcome === "failed"
    ? refusedWith({
        written,
        removed,
        refusal: { kind: "team-config-refused", refusal: configs.error },
      })
    : { written, removed, outcome: configs };
};

export const versionOneProjectionsOver =
  (sources: VersionOneProjectionSources): VersionOneProjectionsOf =>
  async () => {
    const projected = await sources.project();
    return projected.outcome === "failed"
      ? refusedWith({
          written: sources.writes(),
          removed: [],
          refusal: { kind: "project-failed", detail: projected.error.detail },
        })
      : readOver({ writes: projected.value, sources });
  };
