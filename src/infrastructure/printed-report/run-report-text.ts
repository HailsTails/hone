import type { ShownPathOf } from "../../application/ports/installation/shown-path-of.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { DebtComparisonIssue } from "../../domain/records/answering/debt-comparison.ts";
import {
  RUN_SECTION_NAMES,
  type RunSectionName,
  runSectionRoleOf,
  runVerdictOf,
} from "../../domain/report/report-sections.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { VersionTwoReportOutput } from "../../domain/settings/report-output.ts";
import {
  answeredLine,
  checkLine,
  editionLine,
  findingLine,
  heldLine,
  type NotedContent,
  notRunLine,
  unrecordedLines,
} from "./findings/finding-lines.ts";
import { misnamedLine } from "./misnamed-lines.ts";
import { forfeitedLine, type PruneCommand, paidLine, staleLine } from "./records/debt-lines.ts";
import { carriedLine, recordNoteLine, refusedLines } from "./records/record-lines.ts";
import {
  assessmentLine,
  projectionProblemLine,
  settingsNoteLine,
  unmeasuredLine,
} from "./run-state-lines.ts";
import { symptomLine } from "./symptoms/symptom-lines.ts";

export type RunReportRequest = PruneCommand & {
  readonly report: RunReport;
  readonly catalogue: SymptomCatalogue;
  readonly content: NotedContent;
  readonly symptomPage: string;
  readonly showPage: ShownPathOf;
  readonly projectCommand: string;
  readonly output: VersionTwoReportOutput;
};

type SectionLines = (request: RunReportRequest) => readonly string[];

const SECTION_LINES: Readonly<Record<RunSectionName, SectionLines>> = {
  excluded: (request) => request.report.excluded,
  "not-adopted": (request) => request.report["not-adopted"].map((check) => checkLine({ check })),
  "not-run": (request) => request.report["not-run"].map((check) => notRunLine({ check })),
  editions: (request) => request.report.editions.map((reading) => editionLine({ reading })),
  findings: (request) =>
    request.report.findings.map((finding) =>
      findingLine({
        catalogue: request.catalogue,
        content: request.content,
        finding,
        symptomPage: request.symptomPage,
        showPage: request.showPage,
      }),
    ),
  answered: (request) =>
    request.report.answered.map((answered) =>
      answeredLine({ catalogue: request.catalogue, content: request.content, answered, showPage: request.showPage }),
    ),
  held: (request) =>
    request.report.held.map((held) => heldLine({ catalogue: request.catalogue, held })),
  available: (request) => request.report.available.map((check) => checkLine({ check })),
  stale: (request) =>
    request.report.stale.map((stale) => staleLine({ stale, pruneCommand: request.pruneCommand })),
  forfeited: (request) =>
    request.report.forfeited.map((placed) =>
      forfeitedLine({ placed, pruneCommand: request.pruneCommand }),
    ),
  unrecorded: (request) =>
    request.report.unrecorded.flatMap((exception) =>
      unrecordedLines({ catalogue: request.catalogue, exception }),
    ),
  misnamed: (request) => request.report.misnamed.map((misnamed) => misnamedLine({ misnamed })),
  paid: (request) =>
    request.report.paid.map((paid) => paidLine({ paid, pruneCommand: request.pruneCommand })),
  refused: (request) => request.report.refused.flatMap((refused) => refusedLines({ refused })),
  unmeasured: (request) =>
    request.report.unmeasured.map((unmeasured) =>
      unmeasuredLine({
        projectCommand: request.projectCommand,
        unmeasured,
        problems: request.report["projection-problems"],
      }),
    ),
  "projection-problems": (request) =>
    request.report["projection-problems"].map((problem) =>
      projectionProblemLine({
        projectCommand: request.projectCommand,
        problem,
      }),
    ),
  assessment: (request) => request.report.assessment.map((partial) => assessmentLine({ partial })),
  "settings-notes": (request) =>
    request.report["settings-notes"].map((note) => settingsNoteLine({ note })),
  "record-notes": (request) =>
    request.report["record-notes"].map((recordNote) => recordNoteLine({ recordNote })),
  carried: (request) => request.report.carried.map((listing) => carriedLine({ listing })),
  symptoms: (request) =>
    request.report.symptoms.map((symptom) =>
      symptomLine({ symptom, page: request.symptomPage, showPage: request.showPage }),
    ),
};

type PrintedSection = { readonly name: RunSectionName; readonly lines: readonly string[] };

const headingOf = (request: { readonly section: PrintedSection }): string =>
  `${request.section.name} (${request.section.lines.length})`;

const countLine = (request: { readonly section: PrintedSection }): string => {
  const role = runSectionRoleOf({ section: request.section.name });
  return role === "failing" ? headingOf(request) : `${headingOf(request)} ${role}`;
};

const printedLines = (request: {
  readonly output: VersionTwoReportOutput;
  readonly section: PrintedSection;
}): readonly string[] => {
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

export type AssessmentScope = "" | " (partial assessment)";

export const assessmentScopeOf = (request: { readonly report: RunReport }): AssessmentScope =>
  request.report.assessment.length === 0 ? "" : " (partial assessment)";

const verdictLine = (request: { readonly report: RunReport }): string =>
  `verdict: ${runVerdictOf(request)}${assessmentScopeOf(request)}`;

export const renderRunSectionsText = (request: RunReportRequest): string =>
  RUN_SECTION_NAMES.map((name) => ({
    name,
    lines: SECTION_LINES[name](request),
  }))
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedLines({ output: request.output, section }))
    .map((line) => `${line}\n`)
    .join("") + renderDebtComparison(request);

export const mapRunReportToFailingLines = (
  request: Omit<RunReportRequest, "output">,
): readonly string[] =>
  RUN_SECTION_NAMES.filter((name) => runSectionRoleOf({ section: name }) === "failing")
    .map((name) => ({ name, lines: SECTION_LINES[name]({ ...request, output: "full" }) }))
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => [headingOf({ section }), ...section.lines]);

const mapDebtIssueToLine = (issue: DebtComparisonIssue): string => {
  switch (issue.kind) {
    case "base-unavailable":
      return "landing records or changes could not be read. Fetch the landing history and update your branch to include the pinned landing commit.";
    case "base-refused":
      return "landing records could not be validated";
    case "settings-changed":
      return "hone.config.json changed since the landing commit";
    case "projection-unmeasured":
      return "refresh the projection and restore measured coverage";
    case "coverage-unavailable":
      return `no verified file scope for ${issue.engines.join(", ")}. Run the check with its engine coverage available.`;
    case "no-checks":
      return "no checks selected";
    case "external-checks":
      return "the preview requires checks shipped with Hone";
    case "whole-symptom":
      return `${issue.file} ${issue.symptom}: check-specific landing debt required`;
    case "base-count-missing":
      return `${issue.file} ${issue.check}: landing count is missing`;
    case "head-record-changed":
      return `${issue.file} ${issue.check}: the proposed debt differs from recorded landing debt`;
    case "unmeasured":
      return `${issue.file} ${issue.check}: no verified measurement`;
    case "suppressed":
      return `${issue.file} ${issue.check}: suppressed coverage`;
    case "uncovered":
      return `${issue.file} ${issue.check}: no landing debt allowance, observed ${issue.observed}`;
    case "increased":
      return `${issue.file} ${issue.check}: landing ${issue.ceiling}, observed ${issue.observed}; reduce by ${issue.observed - issue.ceiling}`;
  }
};

const renderDebtComparison = ({ report, output }: RunReportRequest): string => {
  if (report.judged !== "counted-debt" || output === "verdict-only") return "";
  const { revision, issues } = report.debtComparison;
  const landing = revision === undefined ? "" : ` against ${revision}`;
  const heading = `debt comparison (${issues.length})${landing}\n`;
  return output === "counts"
    ? heading
    : `${heading}${issues.map((issue) => `${mapDebtIssueToLine(issue)}\n`).join("")}`;
};

export const renderRunReportText = (request: RunReportRequest): string =>
  `${renderRunSectionsText(request)}${verdictLine(request)}\n`;
