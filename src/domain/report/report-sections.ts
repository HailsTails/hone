import type { RunReport, RunReportSections } from "./run-report.ts";

export type RunSectionName = keyof RunReportSections;

export type RunSectionRole = "failing" | "next-step" | "informational" | "guidance";

export type RunVerdict = "pass" | "fail";

const RUN_SECTION_ROLES: Readonly<Record<RunSectionName, RunSectionRole>> = {
  excluded: "informational",
  "not-adopted": "informational",
  "not-run": "informational",
  editions: "informational",
  findings: "failing",
  answered: "informational",
  held: "informational",
  available: "informational",
  stale: "failing",
  forfeited: "failing",
  unrecorded: "failing",
  misnamed: "failing",
  paid: "next-step",
  refused: "failing",
  unmeasured: "failing",
  "projection-problems": "failing",
  assessment: "informational",
  "settings-notes": "informational",
  "record-notes": "informational",
  carried: "informational",
  symptoms: "guidance",
};

export const RUN_SECTION_NAMES: readonly RunSectionName[] = [
  "excluded",
  "not-adopted",
  "not-run",
  "editions",
  "findings",
  "answered",
  "held",
  "available",
  "stale",
  "forfeited",
  "unrecorded",
  "misnamed",
  "paid",
  "refused",
  "unmeasured",
  "projection-problems",
  "assessment",
  "settings-notes",
  "record-notes",
  "carried",
  "symptoms",
];

export const runSectionRoleOf = (request: { readonly section: RunSectionName }): RunSectionRole =>
  RUN_SECTION_ROLES[request.section];

type FailingRunSection = {
  readonly name: RunSectionName | "debtComparison";
  readonly count: number;
};

export const summariseRunFailures = ({
  report,
}: {
  readonly report: RunReport;
}): { readonly verdict: RunVerdict; readonly sections: readonly FailingRunSection[] } => {
  const sections: FailingRunSection[] = RUN_SECTION_NAMES.filter(
    (name) => runSectionRoleOf({ section: name }) === "failing" && report[name].length > 0,
  ).map((name) => ({ name, count: report[name].length }));
  if (report.judged === "counted-debt" && report.debtComparison.issues.length > 0) {
    sections.push({ name: "debtComparison", count: report.debtComparison.issues.length });
  }
  return { verdict: sections.length === 0 ? "pass" : "fail", sections };
};

export const runVerdictOf = (request: { readonly report: RunReport }): RunVerdict =>
  summariseRunFailures(request).verdict;
