import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { TeamConfigRefusal, VersionOneProjection } from "./team-config-finder.ts";

export type ProjectionsRefusal =
  | { readonly kind: "project-failed"; readonly detail: string }
  | { readonly kind: "project-rewrote"; readonly files: readonly RepoPath[] }
  | { readonly kind: "team-config-refused"; readonly refusal: TeamConfigRefusal }
  | { readonly kind: "slice-left-in-place"; readonly files: readonly RepoPath[] };

export type VersionOneProjectionsReading = {
  readonly removed: readonly RepoPath[];
  readonly outcome: Result<readonly VersionOneProjection[], ProjectionsRefusal>;
};

export type VersionOneProjectionsOf = () => Promise<VersionOneProjectionsReading>;

export type VersionOneProjectionSources = {
  readonly project: () => Promise<Result<readonly ProjectionWrite[], { readonly detail: string }>>;
  readonly teamConfigsOf: (request: { readonly projections: readonly RepoPath[] }) => Result<readonly VersionOneProjection[], TeamConfigRefusal>;
};

type Effect = ProjectionWrite["effect"];

const pathsWith = (request: { readonly writes: readonly ProjectionWrite[]; readonly effect: Effect }): readonly RepoPath[] =>
  request.writes.filter((write) => write.effect === request.effect).map((write) => write.path);

const refusedWith = (request: { readonly removed: readonly RepoPath[]; readonly refusal: ProjectionsRefusal }): VersionOneProjectionsReading => ({
  removed: request.removed,
  outcome: { outcome: "failed", error: request.refusal },
});

const readOver = (request: { readonly writes: readonly ProjectionWrite[]; readonly sources: VersionOneProjectionSources }): VersionOneProjectionsReading => {
  const removed = pathsWith({ writes: request.writes, effect: "removed" });
  const stale = pathsWith({ writes: request.writes, effect: "left-in-place" });
  if (stale.length > 0) {
    return refusedWith({ removed, refusal: { kind: "slice-left-in-place", files: stale } });
  }
  const rewritten = pathsWith({ writes: request.writes, effect: "written" });
  if (rewritten.length > 0) {
    return refusedWith({ removed, refusal: { kind: "project-rewrote", files: rewritten } });
  }
  const configs = request.sources.teamConfigsOf({ projections: pathsWith({ writes: request.writes, effect: "unchanged" }) });
  return configs.outcome === "failed" ? refusedWith({ removed, refusal: { kind: "team-config-refused", refusal: configs.error } }) : { removed, outcome: configs };
};

export const versionOneProjectionsOver =
  (sources: VersionOneProjectionSources): VersionOneProjectionsOf =>
  async () => {
    const written = await sources.project();
    return written.outcome === "failed"
      ? refusedWith({ removed: [], refusal: { kind: "project-failed", detail: written.error.detail } })
      : readOver({ writes: written.value, sources });
  };
