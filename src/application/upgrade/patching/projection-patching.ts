import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProofRefusal, Unrestored } from "../../ports/upgrade/proof-outcome.ts";
import {
  type PlannedFile,
  type ProofWritePorts,
  type ProofWrites,
  rolledBackProofWrites,
  writeProofFiles,
} from "../proof-writes/proof-writes.ts";
import { projectionWithVersionTwoPlugins } from "./version-one-plugin-specifiers.ts";

const VERSION_ONE_ESLINT_PROJECTION = /(?:^|\/)disciplines\.eslint\.mjs$/;

export type ProjectionPatchRequest = {
  readonly ports: ProofWritePorts;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

const plannedPatchOf = (
  request: ProjectionPatchRequest & { readonly file: RepoPath },
): Result<readonly PlannedFile[], ProofRefusal> => {
  const path = request.ports.path.join({ segments: [request.repoRoot, request.file] });
  if (!isAbsolutePath(path)) {
    return {
      outcome: "failed",
      error: { kind: "unplaceable-path", file: request.file, removedByVersionOne: [] },
    };
  }
  const read = request.ports.fileText.read({ path });
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
  const written = writeProofFiles({
    ports: request.ports,
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
  readonly ports: ProofWritePorts;
  readonly repoRoot: AbsolutePath;
  readonly refusal: ProofRefusal;
}): readonly AbsolutePath[] => {
  const { refusal } = request;
  const files = [
    ...("removedByVersionOne" in refusal ? refusal.removedByVersionOne : []),
    ...(refusal.kind === "version-one-project-rewrote" ? refusal.files : []),
  ];
  return files.flatMap((file) => {
    const path = request.ports.path.join({ segments: [request.repoRoot, file] });
    return isAbsolutePath(path) ? [path] : [];
  });
};

const withUnrestored = (request: {
  readonly refusal: ProofRefusal;
  readonly unrestored: readonly Unrestored[];
}): ProofRefusal => {
  const { refusal, unrestored } = request;
  switch (refusal.kind) {
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

export const restoredOriginalProjections = (request: {
  readonly ports: ProofWritePorts;
  readonly repoRoot: AbsolutePath;
  readonly patches: ProofWrites;
  readonly refusal: ProofRefusal;
}): ProofRefusal => {
  if (request.refusal.kind === "removal-failed") {
    return request.refusal;
  }
  const kept = keptAsVersionOneLeftThem(request);
  const unrestored = rolledBackProofWrites({
    ports: request.ports,
    writes: request.patches.filter((write) => !kept.includes(write.path)),
  });
  return withUnrestored({ refusal: request.refusal, unrestored });
};
