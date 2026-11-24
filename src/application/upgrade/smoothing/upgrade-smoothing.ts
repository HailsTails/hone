import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { EffectsApplied, ProofEffects } from "../../ports/upgrade/proof-effect.ts";
import type { ProofRefusal, Smoothed } from "../../ports/upgrade/proof-outcome.ts";
import type {
  SmoothingChanges,
  SmoothingCommands,
  SmoothingFailure,
  SmoothingStep,
} from "../../ports/upgrade/smoothing-commands.ts";
import {
  type ProofQueries,
  type ProofWrites,
  proofWritesAppliedOf,
  rolledBackWrites,
} from "../proof-writes/proof-writes.ts";
import { mapChangesToEffects, type SmoothingEffects } from "./smoothing-effects.ts";

export const SMOOTHING_STEPS: readonly SmoothingStep[] = [
  "project",
  "remove-carried",
  "project",
  "record-debt",
  "project",
  "prune-debt",
  "project",
];

export type SmoothingRequest = {
  readonly queries: ProofQueries;
  readonly effects: ProofEffects;
  readonly commands: SmoothingCommands;
  readonly repoRoot: AbsolutePath;
};

export type SmoothingState = {
  readonly writes: ProofWrites;
  readonly written: readonly RepoPath[];
  readonly smoothed: Smoothed;
};

type StepRan =
  | { readonly step: "project"; readonly changes: SmoothingChanges }
  | {
      readonly step: "remove-carried";
      readonly changes: SmoothingChanges;
      readonly done: Smoothed["removedCarried"];
    }
  | {
      readonly step: "record-debt";
      readonly changes: SmoothingChanges;
      readonly done: Smoothed["recordedDebt"];
    }
  | {
      readonly step: "prune-debt";
      readonly changes: SmoothingChanges;
      readonly done: Smoothed["prunedDebt"];
    };

const NOTHING_APPLIED: EffectsApplied = { outcome: "all-applied", settled: [] };

const NOTHING_SMOOTHED: Smoothed = {
  removedCarried: [],
  recordedDebt: [],
  prunedDebt: [],
  projected: [],
};

const runCommand = async (request: {
  readonly commands: SmoothingCommands;
  readonly step: SmoothingStep;
  readonly written: readonly RepoPath[];
}): Promise<Result<StepRan, SmoothingFailure>> => {
  const { commands, step, written } = request;
  switch (step) {
    case "project": {
      const ran = await commands.project({ written });
      return ran.outcome === "failed"
        ? ran
        : { outcome: "ok", value: { step, changes: ran.value } };
    }
    case "remove-carried": {
      const ran = await commands.removeCarried({ written });
      return ran.outcome === "failed" ? ran : { outcome: "ok", value: { step, ...ran.value } };
    }
    case "record-debt": {
      const ran = await commands.recordDebt({ written });
      return ran.outcome === "failed" ? ran : { outcome: "ok", value: { step, ...ran.value } };
    }
    case "prune-debt": {
      const ran = await commands.pruneDebt({ written });
      return ran.outcome === "failed" ? ran : { outcome: "ok", value: { step, ...ran.value } };
    }
  }
};

const runStep = async (request: {
  readonly commands: SmoothingCommands;
  readonly step: SmoothingStep;
  readonly written: readonly RepoPath[];
}): Promise<Result<StepRan, SmoothingFailure>> => {
  try {
    return await runCommand(request);
  } catch (thrown: unknown) {
    return {
      outcome: "failed",
      error: {
        kind: "run-failed",
        failure: { kind: "unexpected-error", detail: failureDetailOf({ thrown }) },
      },
    };
  }
};

const mapStepToSmoothed = (request: {
  readonly smoothed: Smoothed;
  readonly ran: StepRan;
  readonly planned: SmoothingEffects;
}): Smoothed => {
  const { smoothed, ran, planned } = request;
  switch (ran.step) {
    case "project":
      return {
        ...smoothed,
        projected: [...new Set([...smoothed.projected, ...planned.created, ...planned.changed])],
      };
    case "remove-carried":
      return { ...smoothed, removedCarried: [...smoothed.removedCarried, ...ran.done] };
    case "record-debt":
      return { ...smoothed, recordedDebt: [...smoothed.recordedDebt, ...ran.done] };
    case "prune-debt":
      return { ...smoothed, prunedDebt: [...smoothed.prunedDebt, ...ran.done] };
  }
};

const refusedAfter = (
  request: SmoothingRequest & {
    readonly writes: ProofWrites;
    readonly refusal: ProofRefusal;
  },
): Result<never, ProofRefusal> => {
  const unrestored = rolledBackWrites({ effects: request.effects, writes: request.writes });
  const { refusal } = request;
  switch (refusal.kind) {
    case "write-refused":
      return {
        outcome: "failed",
        error: {
          ...refusal,
          refusal: {
            ...refusal.refusal,
            unrestored: [...refusal.refusal.unrestored, ...unrestored],
          },
        },
      };
    case "smoothing-failed":
      return { outcome: "failed", error: { ...refusal, unrestored } };
    default:
      return { outcome: "failed", error: refusal };
  }
};

const appliedStep = (
  request: SmoothingRequest & {
    readonly state: SmoothingState;
    readonly ran: StepRan;
  },
): Result<SmoothingState, ProofRefusal> => {
  const { state, ran } = request;
  const planned = mapChangesToEffects({ ...request, changes: ran.changes });
  if (planned.outcome === "failed") {
    return refusedAfter({ ...request, writes: state.writes, refusal: planned.error });
  }
  const applied = proofWritesAppliedOf({
    applied:
      planned.value.effects.length === 0
        ? NOTHING_APPLIED
        : request.effects.apply({ effects: planned.value.effects }),
  });
  if (applied.outcome === "stopped") {
    return refusedAfter({
      ...request,
      writes: [...state.writes, ...applied.attempted],
      refusal: {
        kind: "write-refused",
        refusal: { failure: applied.failure, unrestored: [] },
        removedByVersionOne: [],
      },
    });
  }
  return {
    outcome: "ok",
    value: {
      writes: [...state.writes, ...applied.writes],
      written: [...new Set([...state.written, ...planned.value.created])].filter(
        (file) => !planned.value.removed.includes(file),
      ),
      smoothed: mapStepToSmoothed({ smoothed: state.smoothed, ran, planned: planned.value }),
    },
  };
};

const smoothedFrom = async (
  request: SmoothingRequest & {
    readonly steps: readonly SmoothingStep[];
    readonly state: SmoothingState;
  },
): Promise<Result<SmoothingState, ProofRefusal>> => {
  const [step, ...rest] = request.steps;
  if (step === undefined) {
    return { outcome: "ok", value: request.state };
  }
  const ran = await runStep({ commands: request.commands, step, written: request.state.written });
  if (ran.outcome === "failed") {
    return refusedAfter({
      ...request,
      writes: request.state.writes,
      refusal: {
        kind: "smoothing-failed",
        step,
        failure: ran.error,
        unrestored: [],
        removedByVersionOne: [],
      },
    });
  }
  const applied = appliedStep({ ...request, ran: ran.value });
  return applied.outcome === "failed"
    ? applied
    : smoothedFrom({ ...request, steps: rest, state: applied.value });
};

export const runSmoothing = (
  request: SmoothingRequest & {
    readonly writes: ProofWrites;
    readonly written: readonly RepoPath[];
  },
): Promise<Result<SmoothingState, ProofRefusal>> =>
  smoothedFrom({
    ...request,
    steps: SMOOTHING_STEPS,
    state: { writes: request.writes, written: request.written, smoothed: NOTHING_SMOOTHED },
  });
