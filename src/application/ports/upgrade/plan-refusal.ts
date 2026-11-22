import type { UpgradeRefusal } from "../../../domain/records/upgrade/upgrade-refusal.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";

export type ConfigImportRefusal =
  | {
      readonly kind: "no-projection-import";
      readonly file: RepoPath;
      readonly projection: RepoPath;
    }
  | { readonly kind: "several-projection-imports"; readonly file: RepoPath; readonly count: number }
  | { readonly kind: "projection-named-elsewhere"; readonly file: RepoPath };

export type PairingRefusal =
  | {
      readonly kind: "version-one-projection-unpaired";
      readonly projection: RepoPath;
      readonly config: RepoPath;
      readonly folder: string;
    }
  | {
      readonly kind: "version-two-projection-unpaired";
      readonly file: RepoPath;
      readonly folder: string;
    };

export type ReplacementRefusal =
  | { readonly kind: "projections-unpaired"; readonly refusal: PairingRefusal }
  | { readonly kind: "config-import-refused"; readonly refusal: ConfigImportRefusal };

export type TeamConfigRefusal =
  | { readonly kind: "no-file-imports-projection"; readonly projection: RepoPath }
  | {
      readonly kind: "config-candidate-unreadable";
      readonly file: RepoPath;
      readonly detail: string;
    };

export type CarveOutUnanswered = {
  readonly kind: "carve-out-unanswered";
  readonly clause: string;
  readonly file: RepoPath;
};

export type LocationUnanswered = {
  readonly kind: "location-unanswered";
  readonly clause: string;
  readonly file: RepoPath;
};

export type Unanswered = CarveOutUnanswered | LocationUnanswered;

export type ReachBeyondEntries = { readonly symptom: string; readonly file: string };

export type ProjectionFailure = {
  readonly kind: "projection-failed";
  readonly failure: RunLoadFailure;
};

export type PlanRefusal =
  | Unanswered
  | ProjectionFailure
  | ReplacementRefusal
  | { readonly kind: "mapping-refused"; readonly refusals: readonly UpgradeRefusal[] }
  | { readonly kind: "reach-beyond-entries"; readonly records: readonly ReachBeyondEntries[] }
  | { readonly kind: "team-config-refused"; readonly refusal: TeamConfigRefusal }
  | { readonly kind: "slice-left-in-place"; readonly files: readonly RepoPath[] };
