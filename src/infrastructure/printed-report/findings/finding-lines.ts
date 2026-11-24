import {
  type CheckSite,
  checkSiteText,
  findingSiteOf,
  nativeSitesOf,
} from "../../../domain/finding/check-site.ts";
import type { AttributedCheckException, CheckFinding } from "../../../domain/finding/governance.ts";
import { qualifiedCheckAddressOf } from "../../../domain/language-layer/check-address.ts";
import {
  mapAddressToSymptom,
  type RuleContent,
} from "../../../domain/language-layer/rule-content.ts";
import {
  type Check,
  indicatedNamesOf,
  type SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  AnsweredFinding,
  HeldException,
} from "../../../domain/records/answering/answering.ts";
import type { CheckEdition } from "../../../domain/report/run-report.ts";
import type { Remedy, ScriptOptionCause } from "../../../domain/runner/runner-result-types.ts";
import { onOneLine } from "../printed-text.ts";
import { referencesText } from "../records/record-lines.ts";
import { scriptOptionAdviceOf } from "../records/script-option-advice.ts";
import { symptomSourceOf, symptomUnheldText } from "../symptoms/symptom-lines.ts";

type CatalogueRequest = { readonly catalogue: SymptomCatalogue };

const locatedText = (request: {
  readonly site: CheckSite;
  readonly finding: CheckFinding;
}): string =>
  `${checkSiteText(request)} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${onOneLine({ text: request.finding.snippet })}`;

export type NotedContent = RuleContent<"name" | "sourceFile" | "mayIndicate">;

const symptomNote = (request: {
  readonly site: CheckSite;
  readonly symptomPage: string;
  readonly content: NotedContent;
}): string => {
  if (request.site.sited !== "check") return "";
  const found = mapAddressToSymptom({
    content: request.content,
    symptom: request.site.check.symptom,
  });
  if (found.outcome === "failed") return ` ${symptomUnheldText({ failure: found.error })}`;
  const symptom = found.value;
  const source = symptomSourceOf({ symptom, page: request.symptomPage });
  const indicated = indicatedNamesOf({ symptom }).join(", ");
  return ` symptom: ${symptom.name} (${source}) may indicate: ${indicated}`;
};

const mapRemedyToText = (request: { readonly check: Check; readonly remedy: Remedy }): string =>
  ` fix: ${onOneLine({ text: request.remedy.fix })} (${request.check.page}#${request.remedy.form})`;

const fixNote = (request: { readonly site: CheckSite; readonly finding: CheckFinding }): string =>
  request.site.sited === "check" && request.finding.remedy !== undefined
    ? mapRemedyToText({ check: request.site.check, remedy: request.finding.remedy })
    : "";

export const findingLine = (
  request: CatalogueRequest & {
    readonly finding: CheckFinding;
    readonly symptomPage: string;
    readonly content: NotedContent;
  },
): string => {
  const site = findingSiteOf(request);
  return `${locatedText({ site, finding: request.finding })}${symptomNote({ site, symptomPage: request.symptomPage, content: request.content })}${fixNote({ site, finding: request.finding })}`;
};

export const answeredLine = (
  request: CatalogueRequest & { readonly answered: AnsweredFinding },
): string => {
  const { finding, by } = request.answered;
  const site = findingSiteOf({ catalogue: request.catalogue, finding });
  const owedFix = by.some((placed) => placed.record.kind === "debt")
    ? fixNote({ site, finding })
    : "";
  return `${locatedText({ site, finding })}${owedFix}${referencesText({ lead: "answered by", records: by })}`;
};

export const editionLine = (request: { readonly reading: CheckEdition }): string =>
  `${qualifiedCheckAddressOf(request.reading)} ${request.reading.engine.name} edition ${request.reading.edition} of ${request.reading.latest}`;

export const checkLine = (request: { readonly check: Check }): string =>
  qualifiedCheckAddressOf(request);

export const notRunLine = (request: { readonly check: Check }): string =>
  `${qualifiedCheckAddressOf(request)} adopted, engine not run: enforced by review`;

const INLINE_REACH_NOTE: Readonly<Record<"one-check" | "every-selected-check", string>> = {
  "one-check": "",
  "every-selected-check": " names no rule and escapes every selected check",
};

const scriptOptionNote = (request: { readonly cause: ScriptOptionCause }): string => {
  const { problem, fix } = scriptOptionAdviceOf(request);
  return request.cause.kind === "weakens-run" ? ` ${problem}: ${fix}` : `: ${problem}; ${fix}`;
};

const inlineDetail = (request: {
  readonly exception: { readonly file: string; readonly line: number; readonly text: string };
}): string =>
  `${request.exception.file}:${request.exception.line} ${onOneLine({ text: request.exception.text })}`;

const inlineDisableDetail = (request: {
  readonly exception: Extract<AttributedCheckException, { readonly kind: "inline-disable" }>;
}): string => `${inlineDetail(request)}${INLINE_REACH_NOTE[request.exception.reach]}`;

const unrecordedDetail = (request: { readonly exception: AttributedCheckException }): string => {
  const { exception } = request;
  switch (exception.kind) {
    case "ignore":
    case "config-override":
      return exception.file;
    case "suppression-entry":
      return `${exception.file} ${exception.location}`;
    case "inline-disable":
      return inlineDisableDetail({ exception });
    case "inline-rule-config":
      return inlineDetail({ exception });
    case "command-line-option":
      return `${exception.location} ${onOneLine({ text: exception.script })} ${onOneLine({ text: exception.option })}${scriptOptionNote({ cause: exception.cause })}`;
  }
};

export const unrecordedLines = (
  request: CatalogueRequest & { readonly exception: AttributedCheckException },
): readonly string[] =>
  nativeSitesOf(request).map(
    (site) => `${checkSiteText({ site })} ${request.exception.kind} ${unrecordedDetail(request)}`,
  );

export const heldLine = (request: CatalogueRequest & { readonly held: HeldException }): string => {
  const { exception, by } = request.held;
  return `${checkSiteText({ site: findingSiteOf({ catalogue: request.catalogue, finding: exception }) })} ${exception.kind} ${inlineDisableDetail({ exception })}${referencesText({ lead: "held by", records: by })}`;
};
