import type { RunReport } from "./run-report.ts";

export type RunSectionName = keyof RunReport;

export type RunSectionRole = "failing" | "next-step" | "informational" | "guidance";

export type RunVerdict = "pass" | "fail";

const RUN_SECTION_ROLES: Readonly<Record<RunSectionName, RunSectionRole>> = {
  excluded: "informational",
  "not-adopted": "informational",
  "not-run": "informational",
  editions: "informational",
  findings: "failing",
  answered: "informational",
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

export const runVerdictOf = (request: { readonly report: RunReport }): RunVerdict =>
  RUN_SECTION_NAMES.filter((section) => runSectionRoleOf({ section }) === "failing").every(
    (section) => request.report[section].length === 0,
  )
    ? "pass"
    : "fail";
