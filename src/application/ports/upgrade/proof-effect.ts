import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { ProofWrite, Unrestored } from "./proof-outcome.ts";

export type ProofEffect =
  | { readonly kind: "create-directory"; readonly path: AbsolutePath }
  | { readonly kind: "create-file"; readonly path: AbsolutePath; readonly text: string }
  | {
      readonly kind: "replace-file";
      readonly path: AbsolutePath;
      readonly text: string;
      readonly original: string;
    }
  | { readonly kind: "remove-file"; readonly path: AbsolutePath }
  | {
      readonly kind: "remove-restorable-file";
      readonly path: AbsolutePath;
      readonly original: string;
    }
  | { readonly kind: "remove-directory-if-empty"; readonly path: AbsolutePath };

export type SettledEffect =
  | { readonly effect: ProofEffect; readonly outcome: "applied" }
  | { readonly effect: ProofEffect; readonly outcome: "kept" };

export type StoppedEffect =
  | { readonly effect: ProofEffect; readonly outcome: "already-exists"; readonly detail: string }
  | { readonly effect: ProofEffect; readonly outcome: "failed"; readonly detail: string };

export type EffectsApplied =
  | { readonly outcome: "all-applied"; readonly settled: readonly SettledEffect[] }
  | {
      readonly outcome: "stopped";
      readonly settled: readonly SettledEffect[];
      readonly stopped: StoppedEffect;
    };

export type ProofEffects = {
  readonly apply: (request: { readonly effects: readonly ProofEffect[] }) => EffectsApplied;
  readonly undo: (request: { readonly writes: readonly ProofWrite[] }) => readonly Unrestored[];
};
