import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import type { ReportOutput } from "../src/infrastructure/hone-config-file/report-output.ts";
import type { CheckReport } from "../src/domain/report/check-report.ts";
import { renderGuidedReportText } from "../src/infrastructure/printed-report/report-text.ts";
import { SECTION_NAMES, type SectionName } from "../src/domain/report/section-roles.ts";
import type { SymptomGuide } from "../src/infrastructure/printed-report/symptoms/symptom-notes.ts";

export type Fills = Readonly<Record<string, string>>;

export type DocumentedLine = {
  readonly label: string;
  readonly template: string;
};

export type PrintedLine = {
  readonly label: string;
  readonly text: string;
  readonly fills: Fills;
};

export type ContractGaps = {
  readonly undocumented: readonly PrintedLine[];
  readonly unprinted: readonly DocumentedLine[];
};

export type DocumentedRole = {
  readonly section: string;
  readonly role: string;
};

export type EntryFills<Section extends string = SectionName> = (request: { readonly section: Section; readonly position: number }) => Fills;

export type ContractParts = { readonly versionOne: string; readonly versionTwo: string };

const VERSION_TWO_HEADING = "\n# Version 2\n";

const TEMPLATE_ROW = /^\| `([^`]+)` \| `([^`]+)` \|$/;

const ROLE_ROW = /^\| `([^`]+)` \| (failing|next-step|informational|guidance) \|/;

const PLACEHOLDER = /<([^<>]+)>/g;

const HEADING_LINE = /^(\S+) \((\d+)\)(?: |$)/;

const HEADING_LABEL = "heading";

const VERDICT_LABEL = "verdict";

const docLines = (request: { readonly text: string }): readonly string[] =>
  request.text.split("\n").map((line) => line.trimEnd());

export const documentedLinesIn = (request: { readonly text: string }): readonly DocumentedLine[] =>
  docLines(request).flatMap((line) => {
    const row = TEMPLATE_ROW.exec(line);
    return row === null ? [] : [{ label: row[1], template: row[2] }];
  });

export const documentedRolesIn = (request: { readonly text: string }): readonly DocumentedRole[] =>
  docLines(request).flatMap((line) => {
    const row = ROLE_ROW.exec(line);
    return row === null ? [] : [{ section: row[1], role: row[2] }];
  });

export const filledTemplate = (request: { readonly template: string; readonly fills: Fills }): string =>
  request.template.replace(PLACEHOLDER, (placeholder: string, name: string) => request.fills[name] ?? placeholder);

type Fit = "fits" | "misfits";

const fitOf = (request: { readonly printed: PrintedLine; readonly documented: DocumentedLine }): Fit =>
  request.printed.label === request.documented.label &&
  filledTemplate({ template: request.documented.template, fills: request.printed.fills }) === request.printed.text
    ? "fits"
    : "misfits";

export const contractGaps = (request: {
  readonly documented: readonly DocumentedLine[];
  readonly printed: readonly PrintedLine[];
}): ContractGaps => ({
  undocumented: request.printed.filter((printed) =>
    request.documented.every((documented) => fitOf({ printed, documented }) === "misfits"),
  ),
  unprinted: request.documented.filter((documented) =>
    request.printed.every((printed) => fitOf({ printed, documented }) === "misfits"),
  ),
});

type Attribution<Section extends string> = {
  readonly section: Section | undefined;
  readonly position: number;
  readonly lines: readonly PrintedLine[];
};

type Heading<Section extends string> = { readonly section: Section; readonly count: string };

const headingOf = <Section extends string>(request: { readonly line: string; readonly sections: readonly Section[] }): Heading<Section> | undefined => {
  const heading = HEADING_LINE.exec(request.line);
  const section = request.sections.find((name) => name === heading?.[1]);
  return section === undefined || heading === null ? undefined : { section, count: heading[2] };
};

const attributed =
  <Section extends string>(request: { readonly entryFills: EntryFills<Section>; readonly sections: readonly Section[]; readonly first: Section }) =>
  (sofar: Attribution<Section>, line: string): Attribution<Section> => {
    const heading = headingOf({ line, sections: request.sections });
    if (heading !== undefined) {
      const fills = { section: heading.section, count: heading.count };
      return { section: heading.section, position: 0, lines: [...sofar.lines, { label: HEADING_LABEL, text: line, fills }] };
    }
    const section = sofar.section ?? request.first;
    const fills = request.entryFills({ section, position: sofar.position });
    return { ...sofar, position: sofar.position + 1, lines: [...sofar.lines, { label: section, text: line, fills }] };
  };

export const sectionedLinesOf = <Section extends string>(request: {
  readonly text: string;
  readonly sections: readonly Section[];
  readonly first: Section;
  readonly entryFills: EntryFills<Section>;
}): readonly PrintedLine[] => {
  const lines = request.text.split("\n").slice(0, -1);
  const start: Attribution<Section> = { section: undefined, position: 0, lines: [] };
  const entries = lines.slice(0, -1).reduce(attributed(request), start);
  return [...entries.lines, { label: VERDICT_LABEL, text: lines.at(-1) ?? "", fills: {} }];
};

export const reportLinesOf = (request: {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
  readonly entryFills: EntryFills;
  readonly guide: SymptomGuide;
}): readonly PrintedLine[] =>
  sectionedLinesOf({ text: renderGuidedReportText(request), sections: SECTION_NAMES, first: "excluded", entryFills: request.entryFills });

export const contractPartsOf = (request: { readonly text: string }): ContractParts => {
  const at = request.text.indexOf(VERSION_TWO_HEADING);
  return at === -1 ? { versionOne: request.text, versionTwo: "" } : { versionOne: request.text.slice(0, at + 1), versionTwo: request.text.slice(at + 1) };
};

export const contractTextAt = (request: { readonly path: string }): string => {
  const text = createDefaultFileTextPort({}).read(request);
  return text.outcome === "ok" ? text.value : "";
};
