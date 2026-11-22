import type { ReportOutput } from "../settings/report-output.ts";
import type { CheckReport } from "./check-report.ts";

export type CheckOutcome = {
  readonly report: CheckReport;
  readonly output: ReportOutput;
};
