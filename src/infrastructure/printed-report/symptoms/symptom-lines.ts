import type {
  Indication,
  Pointed,
  Recipe,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";

type CatalogueRequest = { readonly catalogue: SymptomCatalogue };

const lowerFirst = (request: { readonly text: string }): string =>
  `${request.text.charAt(0).toLowerCase()}${request.text.slice(1)}`;

const pointedTitleOf = (request: { readonly point: Pointed }): string =>
  request.point.kind === "rule" ? request.point.rule.title : request.point.principle.title;

const indicatedCaseText = (request: { readonly indication: Indication }): string => {
  const caseText = lowerFirst({ text: request.indication.case.title });
  return request.indication.situation === undefined
    ? caseText
    : `${caseText}: ${request.indication.situation}`;
};

const indicationText = (request: { readonly indication: Indication }): string =>
  `${indicatedCaseText(request)} → ${request.indication.points.map((point) => pointedTitleOf({ point })).join(", ")}`;

const recipeSentence = (request: { readonly recipes: readonly Recipe[] }): string => {
  const titles = request.recipes.map((recipe) => recipe.title);
  if (titles.length === 0) {
    return "";
  }
  return ` ${titles.length === 1 ? "Recipe" : "Recipes"}: ${titles.join("; ")}.`;
};

export const symptomSourceOf = (request: {
  readonly symptom: Symptom;
  readonly page: string;
}): string => request.symptom.sourceFile ?? `${request.page}#${request.symptom.name}`;

export const symptomLine = (request: {
  readonly symptom: Symptom;
  readonly page: string;
}): string => {
  const { symptom } = request;
  const indications = symptom.mayIndicate
    .map((indication) => indicationText({ indication }))
    .join("; ");
  return `${symptom.name}: ${symptom.title}. May indicate: ${indications}. The breach usually sits ${symptom.breachUsuallySits}.${recipeSentence(symptom)} Read ${symptomSourceOf(request)}`;
};
