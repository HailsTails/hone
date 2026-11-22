export const REPORT_OUTPUTS = ["full", "failures-only", "counts", "verdict-only"] as const;

export type ReportOutput = (typeof REPORT_OUTPUTS)[number];

export const VERSION_TWO_REPORT_OUTPUTS = ["full", "actionable", "counts", "verdict-only"] as const;

export type VersionTwoReportOutput = (typeof VERSION_TWO_REPORT_OUTPUTS)[number];

export const reportOutputInEffect = <Output extends string>(request: {
  readonly requested: Output | undefined;
  readonly configured: Output;
}): Output => request.requested ?? request.configured;

export const reportOutputOfVersionOne = (request: {
  readonly output: ReportOutput;
}): VersionTwoReportOutput => (request.output === "failures-only" ? "actionable" : request.output);
