import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { Result } from "../../../domain/result.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../../ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../../ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type {
  EffectsApplied,
  ProofEffect,
  ProofEffects,
  SettledEffect,
  StoppedEffect,
} from "../../ports/upgrade/proof-effect.ts";
import type { ProofWrite, Unrestored } from "../../ports/upgrade/proof-outcome.ts";

export type EffectPorts = {
  readonly fileText: Pick<FileTextPort, "write">;
  readonly fileCreation: FileCreationPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directory: DirectoryPort;
  readonly directoryRemoval: DirectoryRemovalPort;
};

type PortAnswer = Result<unknown, { readonly detail: string }>;

const settledOf = (request: {
  readonly effect: ProofEffect;
  readonly answer: PortAnswer;
}): SettledEffect | StoppedEffect =>
  request.answer.outcome === "ok"
    ? { effect: request.effect, outcome: "applied" }
    : { effect: request.effect, outcome: "failed", detail: request.answer.error.detail };

const removedIfEmpty = (request: {
  readonly ports: EffectPorts;
  readonly effect: Extract<ProofEffect, { readonly kind: "remove-directory-if-empty" }>;
}): SettledEffect | StoppedEffect => {
  const { ports, effect } = request;
  const listing = ports.directory.list({ path: effect.path });
  if (listing.outcome === "failed") {
    return settledOf({ effect, answer: listing });
  }
  return listing.value.length > 0
    ? { effect, outcome: "kept" }
    : settledOf({ effect, answer: ports.directoryRemoval.removeEmpty({ path: effect.path }) });
};

const createdFile = (request: {
  readonly ports: EffectPorts;
  readonly effect: Extract<ProofEffect, { readonly kind: "create-file" }>;
}): SettledEffect | StoppedEffect => {
  const { ports, effect } = request;
  const created = ports.fileCreation.createNew({ path: effect.path, text: effect.text });
  if (created.outcome === "ok") {
    return { effect, outcome: "applied" };
  }
  return created.error.kind === "already-exists"
    ? { effect, outcome: "already-exists", detail: `${effect.path} already exists` }
    : { effect, outcome: "failed", detail: created.error.detail };
};

const outcomeOf = (request: {
  readonly ports: EffectPorts;
  readonly effect: ProofEffect;
}): SettledEffect | StoppedEffect => {
  const { ports, effect } = request;
  switch (effect.kind) {
    case "create-directory":
      return settledOf({ effect, answer: ports.directory.create({ path: effect.path }) });
    case "create-file":
      return createdFile({ ports, effect });
    case "replace-file":
      return settledOf({
        effect,
        answer: ports.fileText.write({ path: effect.path, text: effect.text }),
      });
    case "remove-file":
      return settledOf({ effect, answer: ports.fileRemoval.remove({ path: effect.path }) });
    case "remove-directory-if-empty":
      return removedIfEmpty({ ports, effect });
  }
};

const attemptedEffect = (request: {
  readonly ports: EffectPorts;
  readonly effect: ProofEffect;
}): SettledEffect | StoppedEffect => {
  try {
    return outcomeOf(request);
  } catch (thrown: unknown) {
    return { effect: request.effect, outcome: "failed", detail: failureDetailOf({ thrown }) };
  }
};

const appliedAfter = (request: {
  readonly ports: EffectPorts;
  readonly effects: readonly ProofEffect[];
  readonly settled: readonly SettledEffect[];
}): EffectsApplied => {
  const [effect, ...rest] = request.effects;
  if (effect === undefined) {
    return { outcome: "all-applied", settled: request.settled };
  }
  const outcome = attemptedEffect({ ports: request.ports, effect });
  return outcome.outcome === "applied" || outcome.outcome === "kept"
    ? appliedAfter({ ...request, effects: rest, settled: [...request.settled, outcome] })
    : { outcome: "stopped", settled: request.settled, stopped: outcome };
};

export const appliedEffects = (request: {
  readonly ports: EffectPorts;
  readonly effects: readonly ProofEffect[];
}): EffectsApplied => appliedAfter({ ...request, settled: [] });

const undoAnswerOf = (request: {
  readonly ports: EffectPorts;
  readonly write: ProofWrite;
}): PortAnswer => {
  const { ports, write } = request;
  switch (write.kind) {
    case "directory-created":
      return ports.directoryRemoval.removeEmpty({ path: write.path });
    case "file-created":
      return ports.fileRemoval.remove({ path: write.path });
    case "file-replaced":
      return ports.fileText.write({ path: write.path, text: write.original });
  }
};

const undoDetailOf = (request: {
  readonly ports: EffectPorts;
  readonly write: ProofWrite;
}): string | undefined => {
  try {
    const answer = undoAnswerOf(request);
    return answer.outcome === "ok" ? undefined : answer.error.detail;
  } catch (thrown: unknown) {
    return failureDetailOf({ thrown });
  }
};

export const undoneWrites = (request: {
  readonly ports: EffectPorts;
  readonly writes: readonly ProofWrite[];
}): readonly Unrestored[] =>
  request.writes.flatMap((write) => {
    const detail = undoDetailOf({ ports: request.ports, write });
    return detail === undefined ? [] : [{ written: write.kind, path: write.path, detail }];
  });

export const proofEffectsOver = (ports: EffectPorts): ProofEffects => ({
  apply: ({ effects }) => appliedEffects({ ports, effects }),
  undo: ({ writes }) => undoneWrites({ ports, writes }),
});
