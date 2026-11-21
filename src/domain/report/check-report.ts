import type {
  ExceptionRecord,
  InvalidRecord,
} from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { AttributedNativeException, Finding } from "../finding/governance.ts";
import type { DoublyHeld, ExemptedFinding } from "../records/discipline-exceptions/governance.ts";
import type { FilePresence } from "../repository/file-presence.ts";
import type { BaseRevisionAvailability } from "../repository/base-revision-availability.ts";
import type { ClauseAddress } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { ClauseEditionReading } from "../rule-set/edition-types.ts";
import type { MechanismId } from "../rule-set/identifier-types.ts";
import type { RepoPath } from "../../infrastructure/hone-records-folder/repo-path.ts";

export type Unmeasured =
  | {
      readonly kind: "forfeiture-unmeasured" | "import-unmeasured" | "legacy-chain-unmeasured";
      readonly base: BaseRevisionAvailability;
    }
  | {
      readonly kind: "mechanism-not-run";
      readonly mechanism: MechanismId;
      readonly projection: "missing";
    }
  | {
      readonly kind: "mechanism-not-run";
      readonly mechanism: MechanismId;
      readonly projection: "not-included";
      readonly nestedConfigurations: readonly RepoPath[];
    };

export type PartialAssessment = {
  readonly concern: "forfeiture";
  readonly assessedBy: "elsewhere";
  readonly fileCarveOuts: number;
};

export type ProjectionProblem =
  | { readonly scope: "projection"; readonly mechanism: MechanismId; readonly state: "out-of-date" }
  | {
      readonly scope: "slice";
      readonly mechanism: MechanismId;
      readonly state: "out-of-date" | "missing" | "not-applied" | "unconfigured";
      readonly slice: RepoPath;
    };

export type AssessmentSection = "present" | "not-assessed" | "unread";

export type ClauseReading = {
  readonly kind: "clause";
  readonly clause: ClauseAddress;
  readonly assessmentSection: AssessmentSection;
  readonly rulePage: { readonly path: string; readonly presence: FilePresence };
};

export type AssessmentFileNote = {
  readonly kind: "assessment-file";
  readonly state: "not-written" | "unreadable";
  readonly guide: string;
};

export type PaidDebtNote = {
  readonly kind: "paid-debt";
  readonly fileCarveOuts: number;
  readonly projections: readonly MechanismId[];
};

export type ReadFirstEntry = AssessmentFileNote | ClauseReading | PaidDebtNote;

export type CheckReport = {
  readonly excluded: readonly RepoPath[];
  readonly notAdopted: readonly ClauseAddress[];
  readonly notRun: readonly ClauseAddress[];
  readonly editions: readonly ClauseEditionReading[];
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly uncovered: readonly ClauseAddress[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly doublyHeld: readonly DoublyHeld[];
  readonly invalidRecords: readonly InvalidRecord[];
  readonly unmeasured: readonly Unmeasured[];
  readonly projectionProblems: readonly ProjectionProblem[];
  readonly assessment: readonly PartialAssessment[];
  readonly readFirst: readonly ReadFirstEntry[];
};
