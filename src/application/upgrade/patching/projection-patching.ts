import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { ProofRefusal, Unrestored } from "../../ports/upgrade/proof-outcome.ts";
import {
  type PlannedFile,
  type ProofQueries,
  type ProofWrites,
  rolledBackWrites,
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
      error: { kind: "unplaceable-path", file: request.file, removedByVersionOne: [] },
    };
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
        error: { kind: "write-refused", refusal: written.error, removedByVersionOne: [] },
      }
    : written;
};

const keptAsVersionOneLeftThem = (request: {
  readonly queries: Pick<ProofQueries, "path">;
  readonly repoRoot: AbsolutePath;
  readonly refusal: ProofRefusal;
}): readonly AbsolutePath[] => {
  const { refusal } = request;
  const files = [
    ...("removedByVersionOne" in refusal ? refusal.removedByVersionOne : []),
    ...(refusal.kind === "version-one-project-rewrote" ? refusal.files : []),
  ];
  return files.flatMap((file) => {
    const path = request.queries.path.join({ segments: [request.repoRoot, file] });
    return isAbsolutePath(path) ? [path] : [];
  });
};

const withUnrestored = (request: {
  readonly refusal: ProofRefusal;
  readonly unrestored: readonly Unrestored[];
}): ProofRefusal => {
  const { refusal, unrestored } = request;
  switch (refusal.kind) {
    case "team-layout-unreadable":
    case "version-two-run-failed":
    case "directives-name-no-check":
    case "differences":
      return { ...refusal, unrestored: [...refusal.unrestored, ...unrestored] };
    case "write-refused":
      return {
        ...refusal,
        refusal: {
          ...refusal.refusal,
          unrestored: [...refusal.refusal.unrestored, ...unrestored],
        },
      };
    default:
      return refusal;
  }
};

export const restoredAfterRefusal = (request: {
  readonly effects: Pick<ProofEffects, "undo">;
  readonly writes: ProofWrites;
  readonly refusal: ProofRefusal;
}): ProofRefusal => {
  if (request.refusal.kind === "removal-failed") {
    return request.refusal;
  }
  const unrestored = rolledBackWrites({ effects: request.effects, writes: request.writes });
  return withUnrestored({ refusal: request.refusal, unrestored });
};

export const restoredOriginalProjections = (request: {
  readonly queries: Pick<ProofQueries, "path">;
  readonly effects: Pick<ProofEffects, "undo">;
  readonly repoRoot: AbsolutePath;
  readonly patches: ProofWrites;
  readonly refusal: ProofRefusal;
}): ProofRefusal => {
  const kept = keptAsVersionOneLeftThem(request);
  return restoredAfterRefusal({
    effects: request.effects,
    writes: request.patches.filter((write) => !kept.includes(write.path)),
    refusal: request.refusal,
  });
};
