import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { Result } from "../../../domain/result.ts";
import type { EntryKindPort } from "../../ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type {
  EffectsApplied,
  ProofEffect,
  ProofEffects,
  StoppedEffect,
} from "../../ports/upgrade/proof-effect.ts";
import type {
  ProofRefusal,
  ProofWrite,
  ProofWriteFailure,
  ProofWriteRefusal,
  Unrestored,
} from "../../ports/upgrade/proof-outcome.ts";

export type PlannedFile = { readonly path: AbsolutePath; readonly text: string };

export type ProofQueries = {
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly entryKind: EntryKindPort;
  readonly path: Pick<PathPort, "join" | "relative" | "directoryOf">;
};

export type ProofWriteQueries = {
  readonly fileText: Pick<FileTextPort, "read">;
  readonly entryKind: EntryKindPort;
  readonly path: Pick<PathPort, "directoryOf">;
};

export type ProofWrites = readonly ProofWrite[];

type Replacement = { readonly file: PlannedFile; readonly original: string };

const parentOf = (request: {
  readonly queries: ProofWriteQueries;
  readonly path: AbsolutePath;
}): AbsolutePath => {
  const parent = request.queries.path.directoryOf({ path: request.path });
  return isAbsolutePath(parent) ? parent : request.path;
};

const missingDirectoriesOf = (request: {
  readonly queries: ProofWriteQueries;
  readonly path: AbsolutePath;
}): readonly AbsolutePath[] => {
  const parent = parentOf(request);
  return parent === request.path || request.queries.entryKind.kindOf({ path: parent }) !== "absent"
    ? []
    : [...missingDirectoriesOf({ queries: request.queries, path: parent }), parent];
};

const uniquePaths = (request: {
  readonly paths: readonly AbsolutePath[];
}): readonly AbsolutePath[] => [...new Set(request.paths)];

const alreadyExisting = (request: {
  readonly queries: ProofWriteQueries;
  readonly files: readonly PlannedFile[];
}): ProofWriteFailure | undefined => {
  const existing = request.files.find(
    (file) => request.queries.entryKind.kindOf({ path: file.path }) !== "absent",
  );
  return existing === undefined ? undefined : { kind: "path-already-exists", path: existing.path };
};

const effectsOf = (request: {
  readonly queries: ProofWriteQueries;
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly Replacement[];
}): readonly ProofEffect[] => {
  const directories = uniquePaths({
    paths: request.files.flatMap((file) =>
      missingDirectoriesOf({ queries: request.queries, path: file.path }),
    ),
  }).toSorted((left, right) => left.length - right.length);
  return [
    ...directories.map((path): ProofEffect => ({ kind: "create-directory", path })),
    ...request.files.map((file): ProofEffect => ({
      kind: "create-file",
      path: file.path,
      text: file.text,
    })),
    ...request.replacements.map(({ file, original }): ProofEffect => ({
      kind: "replace-file",
      path: file.path,
      text: file.text,
      original,
    })),
  ];
};

const replacementOf = (request: {
  readonly queries: ProofWriteQueries;
  readonly file: PlannedFile;
}): Result<Replacement, ProofWriteFailure> => {
  const read = request.queries.fileText.read({ path: request.file.path });
  return read.outcome === "ok"
    ? { outcome: "ok", value: { file: request.file, original: read.value } }
    : {
        outcome: "failed",
        error: {
          kind: "replaced-file-unreadable",
          path: request.file.path,
          detail: read.error.detail,
        },
      };
};

const replacementsOf = (request: {
  readonly queries: ProofWriteQueries;
  readonly files: readonly PlannedFile[];
}): Result<readonly Replacement[], ProofWriteFailure> => {
  const read = request.files.map((file) => replacementOf({ queries: request.queries, file }));
  const unreadable = read.find((each) => each.outcome === "failed");
  return (
    unreadable ?? {
      outcome: "ok",
      value: read.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
    }
  );
};

export const proofWriteEffectsOf = (request: {
  readonly queries: ProofWriteQueries;
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly PlannedFile[];
}): Result<readonly ProofEffect[], ProofWriteFailure> => {
  const existing = alreadyExisting(request);
  if (existing !== undefined) {
    return { outcome: "failed", error: existing };
  }
  const replacements = replacementsOf({ queries: request.queries, files: request.replacements });
  return replacements.outcome === "failed"
    ? replacements
    : {
        outcome: "ok",
        value: effectsOf({
          queries: request.queries,
          files: request.files,
          replacements: replacements.value,
        }),
      };
};

const writeOf = (request: { readonly effect: ProofEffect }): readonly ProofWrite[] => {
  const { effect } = request;
  switch (effect.kind) {
    case "create-directory":
      return [{ kind: "directory-created", path: effect.path }];
    case "create-file":
      return [{ kind: "file-created", path: effect.path }];
    case "replace-file":
      return [{ kind: "file-replaced", path: effect.path, original: effect.original }];
    case "remove-restorable-file":
      return [{ kind: "file-removed", path: effect.path, original: effect.original }];
    case "remove-file":
    case "remove-directory-if-empty":
      return [];
  }
};

const failureOf = (request: { readonly stopped: StoppedEffect }): ProofWriteFailure => {
  const { effect, outcome, detail } = request.stopped;
  if (outcome === "already-exists") {
    return { kind: "path-already-exists", path: effect.path };
  }
  switch (effect.kind) {
    case "create-directory":
      return { kind: "directory-uncreatable", path: effect.path, detail };
    case "remove-file":
    case "remove-restorable-file":
    case "remove-directory-if-empty":
      return { kind: "unremovable", path: effect.path, detail };
    case "create-file":
    case "replace-file":
      return { kind: "unwritable", path: effect.path, detail };
  }
};

const attemptedReplacementOf = (request: { readonly stopped: StoppedEffect }): ProofWrites =>
  request.stopped.effect.kind === "replace-file" && request.stopped.outcome === "failed"
    ? writeOf(request.stopped)
    : [];

export type ProofWritesApplied =
  | { readonly outcome: "written"; readonly writes: ProofWrites }
  | {
      readonly outcome: "stopped";
      readonly failure: ProofWriteFailure;
      readonly attempted: ProofWrites;
    };

export const proofWritesAppliedOf = (request: {
  readonly applied: EffectsApplied;
}): ProofWritesApplied => {
  const { applied } = request;
  const writes = applied.settled.flatMap(({ effect }) => writeOf({ effect }));
  return applied.outcome === "all-applied"
    ? { outcome: "written", writes }
    : {
        outcome: "stopped",
        failure: failureOf({ stopped: applied.stopped }),
        attempted: [...writes, ...attemptedReplacementOf({ stopped: applied.stopped })],
      };
};

export const rolledBackWrites = (request: {
  readonly effects: Pick<ProofEffects, "undo">;
  readonly writes: ProofWrites;
}): readonly Unrestored[] => request.effects.undo({ writes: request.writes.toReversed() });

export const restoredAfterRefusal = (request: {
  readonly effects: Pick<ProofEffects, "undo">;
  readonly writes: ProofWrites;
  readonly refusal: ProofRefusal;
}): ProofRefusal => {
  if (request.refusal.kind === "removal-failed") {
    return request.refusal;
  }
  const unrestored = rolledBackWrites({ effects: request.effects, writes: request.writes });
  return { ...request.refusal, unrestored: [...request.refusal.unrestored, ...unrestored] };
};

export const writtenProofFiles = (request: {
  readonly queries: ProofWriteQueries;
  readonly effects: ProofEffects;
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly PlannedFile[];
  readonly following?: readonly ProofEffect[];
}): Result<ProofWrites, ProofWriteRefusal> => {
  const effects = proofWriteEffectsOf(request);
  if (effects.outcome === "failed") {
    return { outcome: "failed", error: { failure: effects.error, unrestored: [] } };
  }
  const applied = proofWritesAppliedOf({
    applied: request.effects.apply({ effects: [...effects.value, ...(request.following ?? [])] }),
  });
  return applied.outcome === "written"
    ? { outcome: "ok", value: applied.writes }
    : {
        outcome: "failed",
        error: {
          failure: applied.failure,
          unrestored: rolledBackWrites({ effects: request.effects, writes: applied.attempted }),
        },
      };
};
