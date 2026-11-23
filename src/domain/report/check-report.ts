import type { AttributedNativeException, Finding } from "../finding/governance.ts";
import type {
  ExceptionRecord,
  InvalidRecord,
} from "../records/discipline-exceptions/exception-record.ts";
import type { DoublyHeld, ExemptedFinding } from "../records/discipline-exceptions/governance.ts";
import type { BaseRevisionAvailability } from "../repository/base-revision-availability.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import type { ClauseEditionReading } from "../rule-set/edition-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";

export type Unmeasured =
  | {
      readonly kind: "forfeiture-unmeasured" | "import-unmeasured" | "legacy-chain-unmeasured";
      readonly base: BaseRevisionAvailability;
    }
  | {
      readonly kind: "mechanism-not-run";
      readonly mechanism: EngineId;
      readonly projection: "missing";
    }
  | {
      readonly kind: "mechanism-not-run";
      readonly mechanism: EngineId;
      readonly projection: "not-included";
      readonly nestedConfigurations: readonly RepoPath[];
    };

export type PartialAssessment = {
  readonly concern: "forfeiture";
  readonly assessedBy: "elsewhere";
  readonly fileCarveOuts: number;
};

export type ProjectionProblem =
  | { readonly scope: "projection"; readonly mechanism: EngineId; readonly state: "out-of-date" }
  | {
      readonly scope: "slice";
      readonly mechanism: EngineId;
      readonly state: "out-of-date" | "missing" | "not-applied" | "unconfigured";
      readonly slice: RepoPath;
    };

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
};
