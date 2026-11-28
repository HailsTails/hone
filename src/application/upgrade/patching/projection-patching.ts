import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { ProofRefusal } from "../../ports/upgrade/proof-outcome.ts";
import {
  type PlannedFile,
  type ProofQueries,
  type ProofWrites,
  restoredAfterRefusal,
  writtenProofFiles,
} from "../proof-writes/proof-writes.ts";
import { projectionWithVersionTwoPlugins } from "./version-one-plugin-specifiers.ts";

const VERSION_ONE_ESLINT_PROJECTION = /(?:^|\/)disciplines\.eslint\.mjs$/;

export type ProjectionPatchRequest = {
  readonly queries: ProofQueries;
  readonly effects: ProofEffects;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

const plannedPatchOf = (
  request: ProjectionPatchRequest & { readonly file: RepoPath },
): Result<readonly PlannedFile[], ProofRefusal> => {
  const path = request.queries.path.join({ segments: [request.repoRoot, request.file] });
  if (!isAbsolutePath(path)) {
    return {
      outcome: "failed",
      error: {
        kind: "unplaceable-path",
        file: request.file,
        unrestored: [],
        removedByVersionOne: [],
      },
    };
  }
  if (request.queries.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const read = request.queries.fileText.read({ path });
  if (read.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: {
          kind: "team-config-refused",
          refusal: {
            kind: "config-candidate-unreadable",
            file: request.file,
            detail: read.error.detail,
          },
        },
        unrestored: [],
        removedByVersionOne: [],
      },
    };
  }
  const text = projectionWithVersionTwoPlugins({ text: read.value });
  return { outcome: "ok", value: text === read.value ? [] : [{ path, text }] };
};

const plannedPatchesOf = (
  request: ProjectionPatchRequest,
): Result<readonly PlannedFile[], ProofRefusal> => {
  const planned = request.trackedPaths
    .filter((file) => VERSION_ONE_ESLINT_PROJECTION.test(file))
    .map((file) => plannedPatchOf({ ...request, file }));
  const refused = planned.find((each) => each.outcome === "failed");
  return (
    refused ?? {
      outcome: "ok",
      value: planned.flatMap((each) => (each.outcome === "ok" ? each.value : [])),
    }
  );
};

export const patchedProjectionsOf = (
  request: ProjectionPatchRequest,
): Result<ProofWrites, ProofRefusal> => {
  const planned = plannedPatchesOf(request);
  if (planned.outcome === "failed") {
    return planned;
  }
  const written = writtenProofFiles({
    queries: request.queries,
    effects: request.effects,
    files: [],
    replacements: planned.value,
  });
  return written.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "write-refused", ...written.error, removedByVersionOne: [] },
      }
    : written;
};

const filesVersionOneRemoved = (request: {
  readonly queries: Pick<ProofQueries, "path">;
  readonly repoRoot: AbsolutePath;
  readonly refusal: ProofRefusal;
}): readonly AbsolutePath[] => {
  const { refusal } = request;
  const files = "removedByVersionOne" in refusal ? refusal.removedByVersionOne : [];
  return files.flatMap((file) => {
    const path = request.queries.path.join({ segments: [request.repoRoot, file] });
    return isAbsolutePath(path) ? [path] : [];
  });
};

export const restoredOriginalProjections = (request: {
  readonly queries: Pick<ProofQueries, "path">;
  readonly effects: Pick<ProofEffects, "undo">;
  readonly repoRoot: AbsolutePath;
  readonly writes: ProofWrites;
  readonly refusal: ProofRefusal;
}): ProofRefusal => {
  const removed = filesVersionOneRemoved(request);
  return restoredAfterRefusal({
    effects: request.effects,
    writes: request.writes.filter((write) => !removed.includes(write.path)),
    refusal: request.refusal,
  });
};
