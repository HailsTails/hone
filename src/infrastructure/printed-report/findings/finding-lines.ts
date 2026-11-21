import type { AttributedNativeException, Finding } from "../../command-line/governance.ts";
import type { InlineReach, ScriptOptionCause } from "../../../domain/runner/runner-result-types.ts";
import type { AnsweredFinding } from "../../../domain/records/answering/answering.ts";
import { checkAddressOf } from "../../../domain/language-layer/check-address.ts";
import { type Check, indicatedNamesOf, type SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { type CheckSite, checkSiteText, findingSiteOf, nativeSitesOf } from "../../../domain/finding/check-site.ts";
import { onOneLine } from "../printed-text.ts";
import { referencesText } from "../records/record-lines.ts";
import type { CheckEdition } from "../../../domain/report/run-report.ts";
import { scriptOptionAdviceOf } from "../records/script-option-advice.ts";

type CatalogueRequest = { readonly catalogue: SymptomCatalogue };

const locatedText = (request: { readonly site: CheckSite; readonly finding: Finding }): string =>
  `${checkSiteText(request)} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${onOneLine({ text: request.finding.snippet })}`;

const indicationNote = (request: { readonly site: CheckSite }): string =>
  request.site.sited === "check" ? ` may indicate: ${indicatedNamesOf({ symptom: request.site.check.symptom }).join(", ")}` : "";

const fixNote = (request: { readonly finding: Finding }): string =>
  request.finding.remedy === undefined ? "" : ` fix: ${onOneLine({ text: request.finding.remedy.fix })} (${request.finding.remedy.page}#${request.finding.remedy.section})`;

export const findingLine = (request: CatalogueRequest & { readonly finding: Finding }): string => {
  const site = findingSiteOf(request);
  return `${locatedText({ site, finding: request.finding })}${indicationNote({ site })}${fixNote(request)}`;
};

export const answeredLine = (request: CatalogueRequest & { readonly answered: AnsweredFinding }): string => {
  const { finding, by } = request.answered;
  return `${locatedText({ site: findingSiteOf({ catalogue: request.catalogue, finding }), finding })}${referencesText({ lead: "answered by", records: by })}`;
};

export const editionLine = (request: { readonly reading: CheckEdition }): string =>
  `${checkAddressOf(request.reading)} ${request.reading.engine.name} edition ${request.reading.edition} of ${request.reading.latest}`;

export const checkLine = (request: { readonly check: Check }): string => checkAddressOf(request);

export const notRunLine = (request: { readonly check: Check }): string => `${checkAddressOf(request)} adopted, engine not run: enforced by review`;

const INLINE_REACH_NOTE: Readonly<Record<InlineReach, string>> = {
  "one-clause": "",
  "every-selected-clause": " names no rule and escapes every selected check: naming the rule is the cheap fix",
};

const scriptOptionNote = (request: { readonly cause: ScriptOptionCause }): string => {
  const { problem, fix } = scriptOptionAdviceOf(request);
  return request.cause.kind === "weakens-run" ? ` ${problem}: ${fix}` : `: ${problem}; ${fix}`;
};

const inlineDetail = (request: { readonly exception: { readonly file: string; readonly line: number; readonly text: string } }): string =>
  `${request.exception.file}:${request.exception.line} ${onOneLine({ text: request.exception.text })}`;

const unrecordedDetail = (request: { readonly exception: AttributedNativeException }): string => {
  const { exception } = request;
  switch (exception.kind) {
    case "ignore":
    case "config-override":
      return exception.file;
    case "suppression-entry":
      return `${exception.file} ${exception.location}`;
    case "inline-disable":
      return `${inlineDetail({ exception })}${INLINE_REACH_NOTE[exception.reach]}`;
    case "inline-rule-config":
      return inlineDetail({ exception });
    case "command-line-option":
      return `${exception.location} ${onOneLine({ text: exception.script })} ${onOneLine({ text: exception.option })}${scriptOptionNote({ cause: exception.cause })}`;
  }
};

export const unrecordedLines = (request: CatalogueRequest & { readonly exception: AttributedNativeException }): readonly string[] =>
  nativeSitesOf(request).map((site) => `${checkSiteText({ site })} ${request.exception.kind} ${unrecordedDetail(request)}`);
