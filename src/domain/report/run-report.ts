import type { AttributedNativeException, Finding } from "../finding/governance.ts";
import type { MisnamedRuleId } from "../runner/checks-run-report.ts";
import type { AnsweredFinding, PaidDebt, StaleRecord } from "../records/answering/answering.ts";
import type { CarriedListing, PlacedRecord, RecordNote, RefusedRecord } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsUnmeasured } from "../records/measurement/records-unmeasured.ts";
import type { SettingsNote } from "../settings/settings-note.ts";
import type { Check, Engine, Symptom } from "../language-layer/symptom-catalogue.ts";
import type { Edition } from "../rule-set/edition-types.ts";
import type { RepoPath } from "../../infrastructure/hone-records-folder/repo-path.ts";

export type CheckEdition = { readonly check: Check; readonly engine: Engine; readonly edition: Edition; readonly latest: Edition };

export type EngineNotRun =
  | { readonly kind: "engine-not-run"; readonly engine: Engine; readonly projection: "missing" }
  | { readonly kind: "engine-not-run"; readonly engine: Engine; readonly projection: "not-included"; readonly nestedConfigurations: readonly RepoPath[] }
  | { readonly kind: "engine-not-run"; readonly engine: Engine; readonly projection: "measured-nothing" };

export type RunUnmeasured = RecordsUnmeasured | EngineNotRun;

export type RunProjectionProblem =
  | { readonly scope: "projection"; readonly engine: Engine; readonly state: "out-of-date" }
  | { readonly scope: "slice"; readonly engine: Engine; readonly state: "out-of-date" | "missing" | "unconfigured"; readonly slice: RepoPath };

export type ForfeitureElsewhere = { readonly concern: "forfeiture"; readonly assessedBy: "elsewhere"; readonly debts: number };

export type CarriedStandingElsewhere = { readonly concern: "carried-standing"; readonly assessedBy: "elsewhere"; readonly carried: number };

export type AssessmentLeftElsewhere = ForfeitureElsewhere | CarriedStandingElsewhere;

export type RunReport = {
  readonly excluded: readonly RepoPath[];
  readonly "not-adopted": readonly Check[];
  readonly "not-run": readonly Check[];
  readonly editions: readonly CheckEdition[];
  readonly findings: readonly Finding[];
  readonly answered: readonly AnsweredFinding[];
  readonly uncovered: readonly Check[];
  readonly stale: readonly StaleRecord[];
  readonly forfeited: readonly PlacedRecord[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly misnamed: readonly MisnamedRuleId[];
  readonly paid: readonly PaidDebt[];
  readonly refused: readonly RefusedRecord[];
  readonly unmeasured: readonly RunUnmeasured[];
  readonly "projection-problems": readonly RunProjectionProblem[];
  readonly assessment: readonly AssessmentLeftElsewhere[];
  readonly "settings-notes": readonly SettingsNote[];
  readonly "record-notes": readonly RecordNote[];
  readonly carried: readonly CarriedListing[];
  readonly symptoms: readonly Symptom[];
};
