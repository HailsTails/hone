import type { Finding } from "../finding/governance.ts";
import type { Remedy } from "../runner/runner-result-types.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { sameClauseAddress } from "../rule-set/clause-address.ts";
import type { MechanismId } from "../rule-set/identifier-types.ts";

export type Standing = "accepted" | "proposed";

export type RecordKindName = "authorised-location" | "deviation" | "debt" | "boundary-record" | "dependency-record";

export type TodaysRecordFormat = "authorised-location" | "file-carve-out" | "none-yet";

export type Principle = { readonly name: string; readonly title: string };

export type Rule = { readonly name: string; readonly title: string; readonly principle: Principle; readonly standing: Standing };

export type RecipeReason = { readonly text: string; readonly standing: Standing };

export type Recipe = { readonly name: string; readonly title: string; readonly standing: Standing; readonly reason: RecipeReason };

export type RecordKind = {
  readonly name: RecordKindName;
  readonly title: string;
  readonly phrase: string;
  readonly todaysFormat: TodaysRecordFormat;
};

export type Pointed = { readonly kind: "rule"; readonly rule: Rule } | { readonly kind: "principle"; readonly principle: Principle };

export type Case = { readonly name: string; readonly title: string; readonly standing: Standing; readonly owes: readonly Pointed[] };

export type Indication = { readonly case: Case; readonly situation?: string; readonly points: readonly Pointed[] };

export type CorrectUse = { readonly situation: string; readonly kind: RecordKind; readonly at?: string };

export type Symptom = {
  readonly name: string;
  readonly title: string;
  readonly seen: string;
  readonly mayIndicate: readonly Indication[];
  readonly breachUsuallySits: string;
  readonly recipes: readonly Recipe[];
  readonly correctUses: readonly CorrectUse[];
};

export type FormSight = { readonly section: string; readonly symptom: Symptom };

export type ClauseSight =
  | { readonly kind: "one-symptom"; readonly symptom: Symptom }
  | { readonly kind: "symptom-by-form"; readonly forms: readonly FormSight[] }
  | { readonly kind: "method"; readonly recipe: Recipe; readonly outcomeSeenBy: readonly Symptom[] }
  | { readonly kind: "outside-the-cases" };

export type CataloguedClause = { readonly clause: ClauseAddress; readonly sight: ClauseSight };

export type AlwaysRecordable = { readonly debt: RecordKind; readonly authorisedLocation: RecordKind };

export type Engine = { readonly name: string; readonly mechanism: MechanismId };

export type Check = {
  readonly name: string;
  readonly symptom: Symptom;
  readonly clause: ClauseAddress;
  readonly engines: readonly Engine[];
  readonly forms: readonly string[];
};

export type NamedBan = { readonly outsideDependency: string };

export type SymptomCatalogue = {
  readonly principles: readonly Principle[];
  readonly rules: readonly Rule[];
  readonly cases: readonly Case[];
  readonly recipes: readonly Recipe[];
  readonly recordKinds: readonly RecordKind[];
  readonly alwaysRecordable: AlwaysRecordable;
  readonly engines: readonly Engine[];
  readonly symptoms: readonly Symptom[];
  readonly clauses: readonly CataloguedClause[];
  readonly checks: readonly Check[];
  readonly namedBans: readonly NamedBan[];
};

export type CatalogueHolding = { readonly held: "catalogue"; readonly catalogue: SymptomCatalogue } | { readonly held: "none" };

export type SymptomReading =
  | { readonly reading: "named"; readonly symptom: Symptom }
  | { readonly reading: "sees-no-symptom" }
  | { readonly reading: "not-in-catalogue" };

export const pointedNameOf = (request: { readonly point: Pointed }): string =>
  request.point.kind === "rule" ? request.point.rule.name : request.point.principle.name;

export const indicatedNamesOf = (request: { readonly symptom: Symptom }): readonly string[] => [
  ...new Set(request.symptom.mayIndicate.flatMap((indication) => indication.points.map((point) => pointedNameOf({ point })))),
];

export const NOT_IN_CATALOGUE: SymptomReading = { reading: "not-in-catalogue" };

const formReadingOf = (request: { readonly forms: readonly FormSight[]; readonly remedy: Remedy | undefined }): SymptomReading => {
  const form = request.forms.find((candidate) => candidate.section === request.remedy?.section);
  return form === undefined ? NOT_IN_CATALOGUE : { reading: "named", symptom: form.symptom };
};

const sightReadingOf = (request: { readonly sight: ClauseSight; readonly remedy: Remedy | undefined }): SymptomReading => {
  switch (request.sight.kind) {
    case "one-symptom":
      return { reading: "named", symptom: request.sight.symptom };
    case "symptom-by-form":
      return formReadingOf({ forms: request.sight.forms, remedy: request.remedy });
    case "method":
    case "outside-the-cases":
      return { reading: "sees-no-symptom" };
  }
};

export const symptomReadingOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Pick<Finding, "clause" | "remedy">;
}): SymptomReading => {
  const catalogued = request.catalogue.clauses.find(
    (entry) => sameClauseAddress({ left: entry.clause, right: request.finding.clause }) === "same",
  );
  return catalogued === undefined ? NOT_IN_CATALOGUE : sightReadingOf({ sight: catalogued.sight, remedy: request.finding.remedy });
};
