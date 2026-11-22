import type { Case, Check, Pointed, Recipe, Symptom } from "../../language-layer/symptom-catalogue.ts";
import type { BaseRevisionAvailability } from "../../repository/base-revision-availability.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { WhyChain } from "../why-chain.ts";

export type RecordIssue = { readonly path: readonly PropertyKey[]; readonly message: string };

export type RuntimeFacility = "clock" | "random" | "process" | "json";

export type OutsideParty =
  | { readonly kind: "package"; readonly specifier: string; readonly dependency: string }
  | { readonly kind: "scheme-module"; readonly specifier: string }
  | { readonly kind: "runtime"; readonly facility: RuntimeFacility };

export type Conformist = { readonly model: string; readonly why: string };

export type CarriedStanding = "established" | "unjudged";

export type Carried<Lack extends string> = {
  readonly held: "carried";
  readonly entry: ReadonlyJsonValue;
  readonly lacks: readonly Lack[];
  readonly standing: CarriedStanding;
};

export type Stated = { readonly held: "stated" };

export type SymptomReach = { readonly reaches: "whole-symptom" } | { readonly reaches: "one-check"; readonly check: Check };

export type AuthorisedReach = SymptomReach | { readonly reaches: "unknown-check"; readonly check: string };

export type Debt = {
  readonly kind: "debt";
  readonly symptom: Symptom;
  readonly reach: SymptomReach;
  readonly file: RepoPath;
  readonly note?: string;
  readonly holding: Stated | Carried<never>;
};

export type AuthorisedLocationLack = "case" | "owes" | "whyChain";

export type CatalogueNote =
  | { readonly kind: "unknown-check"; readonly symptom: Symptom; readonly check: string }
  | { readonly kind: "unknown-case"; readonly case: string; readonly owes: string }
  | { readonly kind: "owes-not-owed"; readonly case: Case; readonly owes: string };

export type Owing =
  | { readonly matches: "the-catalogue"; readonly case: Case; readonly owes: Pointed }
  | { readonly matches: "not-the-catalogue"; readonly note: CatalogueNote };

export type AuthorisedLocation = {
  readonly kind: "authorised-location";
  readonly symptom: Symptom;
  readonly reach: AuthorisedReach;
  readonly file: RepoPath;
  readonly holding: (Stated & { readonly owing: Owing; readonly whyChain: WhyChain }) | Carried<AuthorisedLocationLack>;
};

export type Deviation = {
  readonly kind: "deviation";
  readonly recipe: Recipe;
  readonly file: RepoPath;
  readonly reasonFails: string;
  readonly evidence: string;
  readonly ruleHolds: string;
};

export type BoundaryRecordLack = "ports";

export type BoundaryRecord = {
  readonly kind: "boundary-record";
  readonly module: RepoPath;
  readonly outsideParty: OutsideParty;
  readonly holding: (Stated & { readonly ports: readonly string[]; readonly conformist?: Conformist }) | Carried<BoundaryRecordLack>;
};

export type DependencyRecord = {
  readonly kind: "dependency-record";
  readonly dependency: string;
  readonly nativeWay: string;
  readonly whyNotEnough: string;
  readonly peerRisk?: string;
};

export type HoneRecord = Debt | AuthorisedLocation | Deviation | BoundaryRecord | DependencyRecord;

export type RecordsFolderKind = "authorised-locations" | "debt" | "deviations" | "boundary-records" | "dependency-records";

export type RecordPlace = { readonly file: RepoPath; readonly index: number };

export type PlacedRecord = { readonly place: RecordPlace; readonly record: HoneRecord };

export type RecordRefusal =
  | { readonly kind: "form-refused"; readonly issues: readonly RecordIssue[] }
  | { readonly kind: "unknown-symptom"; readonly symptom: string }
  | { readonly kind: "unknown-check"; readonly symptom: string; readonly check: string }
  | { readonly kind: "unknown-recipe"; readonly recipe: string }
  | { readonly kind: "recipe-reason-not-the-catalogues"; readonly recipe: Recipe; readonly recipeReason: string }
  | { readonly kind: "named-ban"; readonly dependency: string }
  | { readonly kind: "unknown-runtime-facility"; readonly outsideParty: string }
  | { readonly kind: "misplaced"; readonly belongsIn: RepoPath }
  | { readonly kind: "not-a-records-name"; readonly name: string }
  | { readonly kind: "carried-changed-since-base" }
  | { readonly kind: "duplicate"; readonly of: RecordPlace };

export type RefusedRecord = { readonly place: RecordPlace; readonly refusals: readonly RecordRefusal[] };

export type RecordsDocument = { readonly file: RepoPath; readonly document: unknown };

export type RecordsAtBase =
  | { readonly measured: "yes"; readonly documents: readonly RecordsDocument[] }
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability };

export type CarriedListing = {
  readonly place: RecordPlace;
  readonly lacks: readonly (AuthorisedLocationLack | BoundaryRecordLack)[];
  readonly standing: CarriedStanding;
};

export type BaseMeasurement = { readonly measured: "yes" } | { readonly measured: "no"; readonly base: BaseRevisionAvailability };

export type RecordNote = { readonly place: RecordPlace; readonly note: CatalogueNote };

export type RecordsReading = {
  readonly records: readonly PlacedRecord[];
  readonly refused: readonly RefusedRecord[];
  readonly notes: readonly RecordNote[];
  readonly base: BaseMeasurement;
};

export type RecordsDocumentRefusal =
  | { readonly kind: "not-a-records-file"; readonly file: RepoPath }
  | { readonly kind: "document-refused"; readonly file: RepoPath; readonly issues: readonly RecordIssue[] };
