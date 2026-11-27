import type { AttributedCheckException, CheckFinding } from "../finding/governance.ts";
import type { Check, Engine, Symptom } from "../language-layer/symptom-catalogue.ts";
import type {
  AnsweredFinding,
  HeldException,
  PaidDebt,
  StaleRecord,
} from "../records/answering/answering.ts";
import type {
  CarriedListing,
  PlacedRecord,
  RecordNote,
  RefusedRecord,
} from "../records/hone-records/hone-record.ts";
import type { RecordsUnmeasured } from "../records/measurement/records-unmeasured.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";
import type { Edition } from "../rule-set/edition-types.ts";
import type {
  ChecksSliceProblem,
  MisnamedRuleId,
  ProjectionInclusion,
} from "../runner/checks-run-report.ts";
import type { SettingsNote } from "../settings/settings-note.ts";

export type CheckEdition = {
  readonly check: Check;
  readonly engine: Engine;
  readonly edition: Edition;
  readonly latest: Edition;
};

export type EngineNotRun =
  | {
      readonly kind: "engine-not-run";
      readonly engine: Engine;
      readonly projection: "missing";
      readonly file: RepoPath;
    }
  | {
      readonly kind: "engine-not-run";
      readonly engine: Engine;
      readonly projection: "not-included";
      readonly file: RepoPath;
      readonly nestedConfigurations: readonly RepoPath[];
      readonly recovery: ProjectionInclusion;
    }
  | {
      readonly kind: "engine-not-run";
      readonly engine: Engine;
      readonly projection: "measured-nothing";
    };

export type MissingProjection = Extract<EngineNotRun, { readonly projection: "missing" }>;

export type RunUnmeasured = RecordsUnmeasured | EngineNotRun;

export type RunProjectionProblem =
  | {
      readonly scope: "projection";
      readonly engine: Engine;
      readonly state: "out-of-date";
      readonly file: RepoPath;
    }
  | {
      readonly scope: "file";
      readonly engine: Engine;
      readonly state: "left-over";
      readonly file: RepoPath;
    }
  | Readonly<ChecksSliceProblem & { scope: "slice"; engine: Engine }>;

export type ForfeitureElsewhere = {
  readonly concern: "forfeiture";
  readonly assessedBy: "elsewhere";
  readonly debts: number;
};

export type CarriedStandingElsewhere = {
  readonly concern: "carried-standing";
  readonly assessedBy: "elsewhere";
  readonly carried: number;
};

export type AssessmentLeftElsewhere = ForfeitureElsewhere | CarriedStandingElsewhere;

export type RunAssessment =
  | AssessmentLeftElsewhere
  | {
      readonly concern: "nested-projection";
      readonly engine: Engine;
      readonly folders: readonly RepoPath[];
    };

export type RunReport = {
  readonly excluded: readonly RepoPath[];
  readonly "not-adopted": readonly Check[];
  readonly "not-run": readonly Check[];
  readonly editions: readonly CheckEdition[];
  readonly findings: readonly CheckFinding[];
  readonly answered: readonly AnsweredFinding[];
  readonly held: readonly HeldException[];
  readonly available: readonly Check[];
  readonly stale: readonly StaleRecord[];
  readonly forfeited: readonly PlacedRecord[];
  readonly unrecorded: readonly AttributedCheckException[];
  readonly misnamed: readonly MisnamedRuleId[];
  readonly paid: readonly PaidDebt[];
  readonly refused: readonly RefusedRecord[];
  readonly unmeasured: readonly RunUnmeasured[];
  readonly "projection-problems": readonly RunProjectionProblem[];
  readonly assessment: readonly RunAssessment[];
  readonly "settings-notes": readonly SettingsNote[];
  readonly "record-notes": readonly RecordNote[];
  readonly carried: readonly CarriedListing[];
  readonly symptoms: readonly Symptom[];
};
