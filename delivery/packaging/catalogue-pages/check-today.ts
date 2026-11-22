import { clauseAddressText } from "../../../src/domain/rule-set/clause-address.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";

export type CheckToday = "reuse" | "partial" | "only review" | "review" | "new";

type Symptom = CatalogueFile["symptoms"][number];

type Sight = CatalogueFile["clauses"][number]["sight"];

const symptomsSeenBy = (request: { readonly sight: Sight }): readonly string[] => {
  const { sight } = request;
  switch (sight.kind) {
    case "one-symptom":
      return [sight.symptom];
    case "symptom-by-form":
      return sight.forms.map((form) => form.symptom);
    case "method":
      return sight.outcomeSeenBy;
    case "outside-the-cases":
      return [];
  }
};

const reviewedBy = (request: { readonly file: CatalogueFile; readonly symptom: Symptom }): "a review clause" | "no review clause" => {
  const checkedClauses = new Set(request.file.checks.map((check) => clauseAddressText({ address: check.clause })));
  return request.file.clauses.some(
    (entry) => !checkedClauses.has(clauseAddressText({ address: entry.clause })) && symptomsSeenBy({ sight: entry.sight }).includes(request.symptom.name),
  )
    ? "a review clause"
    : "no review clause";
};

export const checkTodayOf = (request: { readonly file: CatalogueFile; readonly symptom: Symptom }): CheckToday => {
  const checks = request.file.checks.filter((check) => check.symptom === request.symptom.name);
  if (checks.length > 0) {
    return checks.every((check) => check.misses !== undefined) ? "partial" : "reuse";
  }
  if (request.symptom.seenBy[0] === "person") {
    return "only review";
  }
  return reviewedBy(request) === "a review clause" ? "review" : "new";
};
