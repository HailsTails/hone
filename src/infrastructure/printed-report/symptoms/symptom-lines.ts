import { findingSiteOf } from "../../../domain/finding/check-site.ts";
import type { Finding } from "../../../domain/finding/governance.ts";
import type {
  CorrectUse,
  Indication,
  Pointed,
  Recipe,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";

type CatalogueRequest = { readonly catalogue: SymptomCatalogue };

const lowerFirst = (request: { readonly text: string }): string =>
  `${request.text.charAt(0).toLowerCase()}${request.text.slice(1)}`;

const upperFirst = (request: { readonly text: string }): string =>
  `${request.text.charAt(0).toUpperCase()}${request.text.slice(1)}`;

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

const useSentence = (request: { readonly use: CorrectUse }): string => {
  const place = request.use.at === undefined ? "" : ` ${request.use.at}`;
  return `${upperFirst({ text: request.use.situation })}: ${request.use.kind.phrase}${place}.`;
};

export const symptomLine = (
  request: CatalogueRequest & { readonly symptom: Symptom; readonly page: string },
): string => {
  const { symptom } = request;
  const knownDebt: CorrectUse = {
    situation: "known debt",
    kind: request.catalogue.alwaysRecordable.debt,
  };
  const indications = symptom.mayIndicate
    .map((indication) => indicationText({ indication }))
    .join("; ");
  const uses = [...symptom.correctUses, knownDebt].map((use) => useSentence({ use })).join(" ");
  return `${symptom.name}: ${symptom.title}. May indicate: ${indications}. The breach usually sits ${symptom.breachUsuallySits}.${recipeSentence(symptom)} ${uses} Read ${request.page}#${symptom.name}`;
};

export const findingSymptomsOf = (
  request: CatalogueRequest & { readonly findings: readonly Finding[] },
): readonly Symptom[] => {
  const symptoms = request.findings.flatMap((finding) => {
    const site = findingSiteOf({ catalogue: request.catalogue, finding });
    return site.sited === "check" ? [site.check.symptom] : [];
  });
  return symptoms.filter(
    (symptom, index) => symptoms.findIndex((earlier) => earlier.name === symptom.name) === index,
  );
};
