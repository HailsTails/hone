import type { ReportOutput } from "../../domain/settings/report-output.ts";
import { type SectionName, sectionRoleOf } from "../../domain/report/section-roles.ts";

export type ReportSection = {
  readonly name: SectionName;
  readonly lines: readonly string[];
};

const heading = (request: { readonly section: ReportSection }): string =>
  `${request.section.name} (${request.section.lines.length})`;

const headedEntries = (request: { readonly section: ReportSection }): readonly string[] => [
  heading(request),
  ...request.section.lines,
];

const failingEntries = (request: { readonly section: ReportSection }): readonly string[] =>
  sectionRoleOf({ section: request.section.name }) === "informational" ? [] : headedEntries(request);

const countLine = (request: { readonly section: ReportSection }): string => {
  const role = sectionRoleOf({ section: request.section.name });
  return role === "failing" ? heading(request) : `${heading(request)} ${role}`;
};

export const printedSectionLines = (request: {
  readonly output: ReportOutput;
  readonly section: ReportSection;
}): readonly string[] => {
  switch (request.output) {
    case "full":
      return headedEntries(request);
    case "failures-only":
      return failingEntries(request);
    case "counts":
      return [countLine(request)];
    case "verdict-only":
      return [];
  }
};
