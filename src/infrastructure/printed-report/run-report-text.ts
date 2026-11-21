import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoReportOutput } from "../hone-config-file/report-output.ts";
import { forfeitedLine, type PruneCommand, paidLine, staleLine } from "./records/debt-lines.ts";
import { answeredLine, checkLine, editionLine, findingLine, notRunLine, unrecordedLines } from "./findings/finding-lines.ts";
import { misnamedLine } from "./misnamed-lines.ts";
import { carriedLine, recordNoteLine, refusedLines } from "./records/record-lines.ts";
import { RUN_SECTION_NAMES, type RunSectionName, runSectionRoleOf, runVerdictOf } from "../../domain/report/report-sections.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import { assessmentLine, projectionProblemLine, settingsNoteLine, unmeasuredLine } from "./run-state-lines.ts";
import { symptomLine } from "./symptoms/symptom-lines.ts";

export type RunReportRequest = PruneCommand & {
  readonly report: RunReport;
  readonly catalogue: SymptomCatalogue;
  readonly symptomPage: string;
  readonly projectCommand: string;
  readonly output: VersionTwoReportOutput;
};

type SectionLines = (request: RunReportRequest) => readonly string[];

const SECTION_LINES: Readonly<Record<RunSectionName, SectionLines>> = {
  excluded: (request) => request.report.excluded,
  "not-adopted": (request) => request.report["not-adopted"].map((check) => checkLine({ check })),
  "not-run": (request) => request.report["not-run"].map((check) => notRunLine({ check })),
  editions: (request) => request.report.editions.map((reading) => editionLine({ reading })),
  findings: (request) => request.report.findings.map((finding) => findingLine({ catalogue: request.catalogue, finding })),
  answered: (request) => request.report.answered.map((answered) => answeredLine({ catalogue: request.catalogue, answered })),
  uncovered: (request) => request.report.uncovered.map((check) => checkLine({ check })),
  stale: (request) => request.report.stale.map((stale) => staleLine({ stale, pruneCommand: request.pruneCommand })),
  forfeited: (request) => request.report.forfeited.map((placed) => forfeitedLine({ placed, pruneCommand: request.pruneCommand })),
  unrecorded: (request) => request.report.unrecorded.flatMap((exception) => unrecordedLines({ catalogue: request.catalogue, exception })),
  misnamed: (request) => request.report.misnamed.map((misnamed) => misnamedLine({ misnamed })),
  paid: (request) => request.report.paid.map((paid) => paidLine({ paid, pruneCommand: request.pruneCommand })),
  refused: (request) => request.report.refused.flatMap((refused) => refusedLines({ refused })),
  unmeasured: (request) =>
    request.report.unmeasured.map((unmeasured) => unmeasuredLine({ projectCommand: request.projectCommand, unmeasured, problems: request.report["projection-problems"] })),
  "projection-problems": (request) => request.report["projection-problems"].map((problem) => projectionProblemLine({ projectCommand: request.projectCommand, problem })),
  assessment: (request) => request.report.assessment.map((partial) => assessmentLine({ partial })),
  "settings-notes": (request) => request.report["settings-notes"].map((note) => settingsNoteLine({ note })),
  "record-notes": (request) => request.report["record-notes"].map((recordNote) => recordNoteLine({ recordNote })),
  carried: (request) => request.report.carried.map((listing) => carriedLine({ listing })),
  symptoms: (request) => request.report.symptoms.map((symptom) => symptomLine({ catalogue: request.catalogue, symptom, page: request.symptomPage })),
};

type PrintedSection = { readonly name: RunSectionName; readonly lines: readonly string[] };

const headingOf = (request: { readonly section: PrintedSection }): string => `${request.section.name} (${request.section.lines.length})`;

const countLine = (request: { readonly section: PrintedSection }): string => {
  const role = runSectionRoleOf({ section: request.section.name });
  return role === "failing" ? headingOf(request) : `${headingOf(request)} ${role}`;
};

const printedLines = (request: { readonly output: VersionTwoReportOutput; readonly section: PrintedSection }): readonly string[] => {
  const headed = [headingOf(request), ...request.section.lines];
  switch (request.output) {
    case "full":
      return headed;
    case "actionable":
      return runSectionRoleOf({ section: request.section.name }) === "informational" ? [] : headed;
    case "counts":
      return [countLine(request)];
    case "verdict-only":
      return [];
  }
};

const verdictLine = (request: { readonly report: RunReport }): string =>
  request.report.assessment.length === 0 ? `verdict: ${runVerdictOf(request)}` : `verdict: ${runVerdictOf(request)} (partial assessment)`;

export const renderRunReportText = (request: RunReportRequest): string => {
  const sectionLines = RUN_SECTION_NAMES.map((name) => ({ name, lines: SECTION_LINES[name](request) }))
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedLines({ output: request.output, section }));
  return `${[...sectionLines, verdictLine(request)].join("\n")}\n`;
};
