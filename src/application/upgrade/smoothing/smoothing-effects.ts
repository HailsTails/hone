import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProofEffect } from "../../ports/upgrade/proof-effect.ts";
import type { ProofRefusal } from "../../ports/upgrade/proof-outcome.ts";
import type { ChangedFile, SmoothingChanges } from "../../ports/upgrade/smoothing-commands.ts";
import { type ProofQueries, proofWriteEffectsOf } from "../proof-writes/proof-writes.ts";

export type SmoothingEffects = {
  readonly effects: readonly ProofEffect[];
  readonly created: readonly RepoPath[];
  readonly changed: readonly RepoPath[];
  readonly removed: readonly RepoPath[];
};

type Placed<Change> = { readonly change: Change; readonly path: AbsolutePath };

type Planning = {
  readonly queries: ProofQueries;
  readonly repoRoot: AbsolutePath;
};

const unplaceable = (request: { readonly file: RepoPath }): Result<never, ProofRefusal> => ({
  outcome: "failed",
  error: { kind: "unplaceable-path", file: request.file, removedByVersionOne: [] },
});

const placeChange = <Change>(
  request: Planning & { readonly change: Change; readonly file: RepoPath },
): Result<Placed<Change>, ProofRefusal> => {
  const path = request.queries.path.join({ segments: [request.repoRoot, request.file] });
  return isAbsolutePath(path)
    ? { outcome: "ok", value: { change: request.change, path } }
    : unplaceable({ file: request.file });
};

const placeEvery = <Change>(
  request: Planning & {
    readonly changes: readonly Change[];
    readonly fileOf: (change: Change) => RepoPath;
  },
): Result<readonly Placed<Change>[], ProofRefusal> => {
  const placed = request.changes.map((change) =>
    placeChange({ ...request, change, file: request.fileOf(change) }),
  );
  const failed = placed.find((each) => each.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: placed.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
    }
  );
};

const writeRefused = (request: {
  readonly failure: Extract<ProofRefusal, { readonly kind: "write-refused" }>["refusal"]["failure"];
}): Result<never, ProofRefusal> => ({
  outcome: "failed",
  error: {
    kind: "write-refused",
    refusal: { failure: request.failure, unrestored: [] },
    removedByVersionOne: [],
  },
});

const mapRemovalToEffect = (
  request: Planning & { readonly removal: Placed<RepoPath> },
): Result<ProofEffect, ProofRefusal> => {
  const { path } = request.removal;
  const original = request.queries.fileText.read({ path });
  return original.outcome === "ok"
    ? { outcome: "ok", value: { kind: "remove-restorable-file", path, original: original.value } }
    : writeRefused({
        failure: { kind: "removed-file-unreadable", path, detail: original.error.detail },
      });
};

const mapRemovalsToEffects = (
  request: Planning & { readonly removals: readonly Placed<RepoPath>[] },
): Result<readonly ProofEffect[], ProofRefusal> => {
  const effects = request.removals.map((removal) => mapRemovalToEffect({ ...request, removal }));
  const failed = effects.find((each) => each.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: effects.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
    }
  );
};

type TextChange = "changes-text" | "keeps-text";

const mapEffectToTextChange = (effect: ProofEffect): TextChange =>
  effect.kind === "replace-file" && effect.text === effect.original ? "keeps-text" : "changes-text";

const filesChangedBy = (request: {
  readonly effects: readonly ProofEffect[];
  readonly writes: readonly Placed<ChangedFile>[];
  readonly kind: "create-file" | "replace-file";
}): readonly RepoPath[] =>
  request.writes
    .filter(({ path }) =>
      request.effects.some((effect) => effect.kind === request.kind && effect.path === path),
    )
    .map(({ change }) => change.file);

export const mapChangesToEffects = (
  request: Planning & { readonly changes: SmoothingChanges },
): Result<SmoothingEffects, ProofRefusal> => {
  const writes = placeEvery({
    ...request,
    changes: request.changes.write,
    fileOf: (change) => change.file,
  });
  if (writes.outcome === "failed") return writes;
  const removals = placeEvery({
    ...request,
    changes: request.changes.remove,
    fileOf: (file) => file,
  });
  if (removals.outcome === "failed") return removals;
  const present = writes.value.filter(
    ({ path }) => request.queries.entryKind.kindOf({ path }) !== "absent",
  );
  const written = proofWriteEffectsOf({
    queries: request.queries,
    files: writes.value
      .filter((write) => !present.includes(write))
      .map(({ change, path }) => ({ path, text: change.text })),
    replacements: present.map(({ change, path }) => ({ path, text: change.text })),
  });
  if (written.outcome === "failed") return writeRefused({ failure: written.error });
  const removed = mapRemovalsToEffects({ ...request, removals: removals.value });
  if (removed.outcome === "failed") return removed;
  const effects = [
    ...written.value.filter((effect) => mapEffectToTextChange(effect) === "changes-text"),
    ...removed.value,
  ];
  return {
    outcome: "ok",
    value: {
      effects,
      created: filesChangedBy({ effects, writes: writes.value, kind: "create-file" }),
      changed: filesChangedBy({ effects, writes: writes.value, kind: "replace-file" }),
      removed: removals.value.map(({ change }) => change),
    },
  };
};
