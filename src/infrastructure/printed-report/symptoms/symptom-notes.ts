import type { Finding } from "../../command-line/governance.ts";
import {
  type CorrectUse,
  type Indication,
  NOT_IN_CATALOGUE,
  type Pointed,
  type RecordKind,
  type Symptom,
  type SymptomCatalogue,
  type SymptomReading,
  symptomReadingOf,
} from "../../../domain/language-layer/symptom-catalogue.ts";

export type CatalogueGuide = { readonly guide: "catalogue"; readonly catalogue: SymptomCatalogue; readonly page: string };

export type UnreadableGuide = { readonly guide: "unreadable"; readonly failure: string };

export type SymptomGuide = { readonly guide: "none" } | CatalogueGuide | UnreadableGuide;

export const NO_SYMPTOM_GUIDE: SymptomGuide = { guide: "none" };

export const symptomReadingIn = (request: { readonly guide: SymptomGuide; readonly finding: Finding }): SymptomReading =>
  request.guide.guide === "catalogue" ? symptomReadingOf({ catalogue: request.guide.catalogue, finding: request.finding }) : NOT_IN_CATALOGUE;

const lowerFirst = (request: { readonly text: string }): string => `${request.text.charAt(0).toLowerCase()}${request.text.slice(1)}`;

const upperFirst = (request: { readonly text: string }): string => `${request.text.charAt(0).toUpperCase()}${request.text.slice(1)}`;

const pointedTitleOf = (request: { readonly point: Pointed }): string =>
  request.point.kind === "rule" ? request.point.rule.title : request.point.principle.title;

const indicatedCaseText = (request: { readonly indication: Indication }): string => {
  const caseText = lowerFirst({ text: request.indication.case.title });
  return request.indication.situation === undefined ? caseText : `${caseText}: ${request.indication.situation}`;
};

const indicationText = (request: { readonly indication: Indication }): string =>
  `${indicatedCaseText(request)} → ${request.indication.points.map((point) => pointedTitleOf({ point })).join(", ")}`;

const recipeSentence = (request: { readonly symptom: Symptom }): string => {
  const titles = request.symptom.recipes.map((recipe) => recipe.title);
  if (titles.length === 0) {
    return "";
  }
  return ` ${titles.length === 1 ? "Recipe" : "Recipes"}: ${titles.join("; ")}.`;
};

const formatText = (request: { readonly kind: RecordKind }): string =>
  request.kind.todaysFormat === "none-yet" ? "no record format yet" : `today: ${request.kind.todaysFormat}`;

const useSentence = (request: { readonly use: CorrectUse }): string => {
  const { use } = request;
  const place = use.at === undefined ? "" : ` ${use.at}`;
  return `${upperFirst({ text: use.situation })}: ${use.kind.phrase}${place} (${formatText({ kind: use.kind })}).`;
};

const recordSentences = (request: { readonly catalogue: SymptomCatalogue; readonly symptom: Symptom }): string => {
  const knownDebt: CorrectUse = { situation: "known debt", kind: request.catalogue.alwaysRecordable.debt };
  return [...request.symptom.correctUses, knownDebt].map((use) => useSentence({ use })).join(" ");
};

export const symptomNoteLineOf = (request: CatalogueGuide & { readonly symptom: Symptom }): string => {
  const { symptom } = request;
  const indications = symptom.mayIndicate.map((indication) => indicationText({ indication })).join("; ");
  return `${symptom.name}: ${symptom.title}. May indicate: ${indications}. The breach usually sits ${symptom.breachUsuallySits}.${recipeSentence(request)} ${recordSentences(request)} Read ${request.page}#${symptom.name}`;
};

const namedSymptomsOf = (request: { readonly guide: CatalogueGuide; readonly findings: readonly Finding[] }): readonly Symptom[] => [
  ...new Map(
    request.findings.flatMap((finding) => {
      const reading = symptomReadingOf({ catalogue: request.guide.catalogue, finding });
      return reading.reading === "named" ? [[reading.symptom.name, reading.symptom] as const] : [];
    }),
  ).values(),
];

const unreadableLine = (request: { readonly guide: UnreadableGuide }): string =>
  `symptom catalogue not read, so no finding names its symptom: ${request.guide.failure}`;

export const symptomNoteLinesOf = (request: { readonly guide: SymptomGuide; readonly findings: readonly Finding[] }): readonly string[] => {
  const { guide } = request;
  switch (guide.guide) {
    case "none":
      return [];
    case "unreadable":
      return [unreadableLine({ guide })];
    case "catalogue":
      return namedSymptomsOf({ guide, findings: request.findings }).map((symptom) => symptomNoteLineOf({ ...guide, symptom }));
  }
};
