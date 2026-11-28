import type { DebtOutcome } from "../../../domain/records/debt/debt-effects.ts";
import type { PrunableDebt } from "../../../domain/records/debt/prunable-debt.ts";
import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import type { RecordLine } from "../../../domain/records/upgrade/records-mapping.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import type { MisnamedRuleId } from "../../../domain/runner/checks-run-report.ts";
import type { PlanRefusal } from "./plan-refusal.ts";
import type { ProofRunFailure } from "./proof-runs.ts";
import type { OracleFailure } from "./record-answer-oracle.ts";
import type { SmoothingFailure, SmoothingStep } from "./smoothing-commands.ts";

export type ProofWrite =
  | { readonly kind: "directory-created"; readonly path: AbsolutePath }
  | { readonly kind: "file-created"; readonly path: AbsolutePath }
  | { readonly kind: "file-replaced"; readonly path: AbsolutePath; readonly original: string }
  | { readonly kind: "file-removed"; readonly path: AbsolutePath; readonly original: string };

export type ProofWriteFailure =
  | { readonly kind: "path-already-exists"; readonly path: AbsolutePath }
  | {
      readonly kind: "replaced-file-unreadable";
      readonly path: AbsolutePath;
      readonly detail: string;
    }
  | {
      readonly kind: "removed-file-unreadable";
      readonly path: AbsolutePath;
      readonly detail: string;
    }
  | { readonly kind: "directory-uncreatable"; readonly path: AbsolutePath; readonly detail: string }
  | { readonly kind: "unwritable"; readonly path: AbsolutePath; readonly detail: string }
  | { readonly kind: "unremovable"; readonly path: AbsolutePath; readonly detail: string };

export type Unrestored = {
  readonly written: ProofWrite["kind"];
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type ProofWriteRefusal = {
  readonly failure: ProofWriteFailure;
  readonly unrestored: readonly Unrestored[];
};

export type Removed = {
  readonly files: readonly AbsolutePath[];
  readonly folders: readonly AbsolutePath[];
};

export type OutsideRoot = {
  readonly kind: "records-file-outside-root";
  readonly path: AbsolutePath;
  readonly root: AbsolutePath;
};

export type RemovalFailure =
  | OutsideRoot
  | {
      readonly kind: "unremovable";
      readonly path: AbsolutePath;
      readonly detail: string;
      readonly removed: Removed;
    };

export type Smoothed = {
  readonly removedCarried: readonly PlacedRecord[];
  readonly recordedDebt: readonly DebtOutcome[];
  readonly prunedDebt: readonly PrunableDebt[];
  readonly projected: readonly RepoPath[];
};

export type ProofCarriedOver = {
  readonly written: readonly RepoPath[];
  readonly replaced: readonly RepoPath[];
  readonly removed: Removed;
  readonly records: readonly RecordLine[];
  readonly smoothed: Smoothed;
};

export type AfterWriting = {
  readonly written: readonly RepoPath[];
  readonly replaced: readonly RepoPath[];
};

export type ProofRefusalBeforeRemoval = (
  | { readonly kind: "oracle-failed"; readonly failure: OracleFailure }
  | { readonly kind: "plan-refused"; readonly refusal: PlanRefusal }
  | { readonly kind: "version-one-run-failed"; readonly failure: ProofRunFailure }
  | { readonly kind: "version-one-uncovered"; readonly clauses: readonly ClauseAddress[] }
  | { readonly kind: "version-one-project-failed"; readonly detail: string }
  | { readonly kind: "unplaceable-path"; readonly file: RepoPath }
  | { readonly kind: "removal-refused"; readonly failure: OutsideRoot }
  | { readonly kind: "write-refused"; readonly failure: ProofWriteFailure }
  | { readonly kind: "team-layout-unreadable"; readonly failure: LoadFailure }
  | { readonly kind: "version-two-run-failed"; readonly failure: ProofRunFailure }
  | { readonly kind: "directives-name-no-check"; readonly directives: readonly MisnamedRuleId[] }
  | {
      readonly kind: "smoothing-failed";
      readonly step: SmoothingStep;
      readonly failure: SmoothingFailure;
    }
  | { readonly kind: "check-failed"; readonly failing: readonly string[] }
) & {
  readonly removedByVersionOne: readonly RepoPath[];
  readonly unrestored: readonly Unrestored[];
};

export type ProofRefusal =
  | ProofRefusalBeforeRemoval
  | ({
      readonly kind: "removal-failed";
      readonly failure: RemovalFailure;
      readonly remaining: readonly AbsolutePath[];
    } & AfterWriting);
