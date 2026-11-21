import { z } from "zod";

export const reportOutputSchema = z.enum(["full", "failures-only", "counts", "verdict-only"]);

export type ReportOutput = z.infer<typeof reportOutputSchema>;

export const versionTwoReportOutputSchema = z.enum(["full", "actionable", "counts", "verdict-only"]);

export type VersionTwoReportOutput = z.infer<typeof versionTwoReportOutputSchema>;

export const reportOutputInEffect = <Output extends string>(request: {
  readonly requested: Output | undefined;
  readonly configured: Output;
}): Output => request.requested ?? request.configured;

export const reportOutputOfVersionOne = (request: { readonly output: ReportOutput }): VersionTwoReportOutput =>
  request.output === "failures-only" ? "actionable" : request.output;
