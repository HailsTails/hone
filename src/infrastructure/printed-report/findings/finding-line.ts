import type { Finding } from "../../../domain/finding/governance.ts";
import { indicatedNamesOf, type SymptomReading } from "../../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressText } from "../../discipline-exceptions-folder/clause-address.ts";

export const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

export const locatedFindingLine = (request: { readonly finding: Finding }): string =>
  `${clauseAddressText({ address: request.finding.clause })} ${request.finding.mechanism} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${escapedLineBreaks({ text: request.finding.snippet })}`;

const remedyNote = (request: { readonly finding: Finding }): string =>
  request.finding.remedy === undefined
    ? ""
    : ` fix: ${escapedLineBreaks({ text: request.finding.remedy.fix })} (${request.finding.remedy.page}#${request.finding.remedy.section})`;

const symptomNote = (request: { readonly reading: SymptomReading }): string =>
  request.reading.reading === "named"
    ? ` symptom: ${request.reading.symptom.name}, may indicate: ${indicatedNamesOf({ symptom: request.reading.symptom }).join(", ")}`
    : "";

export const symptomFindingLine = (request: { readonly finding: Finding; readonly reading: SymptomReading }): string =>
  `${locatedFindingLine(request)}${symptomNote(request)}${remedyNote(request)}`;
