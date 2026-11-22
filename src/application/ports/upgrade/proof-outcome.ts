import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import type { MisnamedRuleId } from "../../../domain/runner/checks-run-report.ts";
import type { PlanRefusal } from "./plan-refusal.ts";
import type { ProofRunFailure } from "./proof-runs.ts";
import type { OracleFailure } from "./record-answer-oracle.ts";

export const PROOF_SECTIONS = [
  "excluded",
  "findings",
  "answered",
  "unrecorded",
  "misnamed",
  "paid",
  "stale",
  "forfeited",
  "doubly-held",
  "invalid-records",
  "not-adopted",
  "not-run",
  "editions",
  "unmeasured",
  "projection-problems",
  "assessment",
  "verdict",
] as const;

export type ProofSection = (typeof PROOF_SECTIONS)[number];

export type ProofDifference = {
  readonly section: ProofSection;
  readonly onlyBefore: readonly string[];
  readonly onlyAfter: readonly string[];
};

export type ProofWrite =
  | { readonly kind: "directory-created"; readonly path: AbsolutePath }
  | { readonly kind: "file-created"; readonly path: AbsolutePath }
  | { readonly kind: "file-replaced"; readonly path: AbsolutePath; readonly original: string };

export type ProofWriteFailure =
  | { readonly kind: "path-already-exists"; readonly path: AbsolutePath }
  | {
      readonly kind: "replaced-file-unreadable";
      readonly path: AbsolutePath;
      readonly detail: string;
    }
  | { readonly kind: "directory-uncreatable"; readonly path: AbsolutePath; readonly detail: string }
  | { readonly kind: "unwritable"; readonly path: AbsolutePath; readonly detail: string };

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

export type ProofCarriedOver = {
  readonly written: readonly RepoPath[];
  readonly replaced: readonly RepoPath[];
  readonly removed: Removed;
};

export type AfterWriting = {
  readonly written: readonly RepoPath[];
  readonly replaced: readonly RepoPath[];
};

type AfterVersionOneProject = { readonly removedByVersionOne: readonly RepoPath[] };

export type ProofRefusal =
  | { readonly kind: "oracle-failed"; readonly failure: OracleFailure }
  | ({ readonly kind: "plan-refused"; readonly refusal: PlanRefusal } & AfterVersionOneProject)
  | ({
      readonly kind: "version-one-run-failed";
      readonly failure: ProofRunFailure;
    } & AfterVersionOneProject)
  | ({
      readonly kind: "version-one-uncovered";
      readonly clauses: readonly ClauseAddress[];
    } & AfterVersionOneProject)
  | ({
      readonly kind: "version-one-project-failed";
      readonly detail: string;
    } & AfterVersionOneProject)
  | ({
      readonly kind: "version-one-project-rewrote";
      readonly files: readonly RepoPath[];
    } & AfterVersionOneProject)
  | ({ readonly kind: "unplaceable-path"; readonly file: RepoPath } & AfterVersionOneProject)
  | ({ readonly kind: "removal-refused"; readonly failure: OutsideRoot } & AfterVersionOneProject)
  | ({
      readonly kind: "write-refused";
      readonly refusal: ProofWriteRefusal;
    } & AfterVersionOneProject)
  | ({
      readonly kind: "version-two-run-failed";
      readonly failure: ProofRunFailure;
      readonly unrestored: readonly Unrestored[];
    } & AfterVersionOneProject)
  | ({
      readonly kind: "directives-name-no-check";
      readonly directives: readonly MisnamedRuleId[];
      readonly unrestored: readonly Unrestored[];
    } & AfterVersionOneProject)
  | ({
      readonly kind: "differences";
      readonly differences: readonly ProofDifference[];
      readonly unrestored: readonly Unrestored[];
    } & AfterVersionOneProject)
  | ({
      readonly kind: "removal-failed";
      readonly failure: RemovalFailure;
      readonly remaining: readonly AbsolutePath[];
    } & AfterWriting);
