import { describe, expect, it } from "vitest";
import {
  reportOutputInEffect,
  reportOutputOfVersionOne,
  versionTwoReportOutputSchema,
  reportOutputSchema,
  type VersionTwoReportOutput,
  type ReportOutput,
} from "./report-output.ts";

describe("versionTwoReportOutputSchema", () => {
  it.each(["full", "actionable", "counts", "verdict-only"])("accepts %s", (output) => {
    expect(versionTwoReportOutputSchema.safeParse(output)).toEqual({ success: true, data: output });
  });

  it.each(["failures-only", "summary", "", "Full", "quiet", true])("refuses %j", (output) => {
    expect(versionTwoReportOutputSchema.safeParse(output).success).toBe(false);
  });
});

describe("reportOutputSchema", () => {
  it.each(["full", "failures-only", "counts", "verdict-only"])("accepts %s", (output) => {
    expect(reportOutputSchema.safeParse(output)).toEqual({ success: true, data: output });
  });

  it.each(["actionable", "summary", "", "Full", "quiet", true])("refuses %j", (output) => {
    expect(reportOutputSchema.safeParse(output).success).toBe(false);
  });
});

describe("reportOutputOfVersionOne", () => {
  it.each<{ readonly output: ReportOutput; readonly carried: VersionTwoReportOutput }>([
    { output: "full", carried: "full" },
    { output: "failures-only", carried: "actionable" },
    { output: "counts", carried: "counts" },
    { output: "verdict-only", carried: "verdict-only" },
  ])("carries version 1's $output as $carried", ({ output, carried }) => {
    expect(reportOutputOfVersionOne({ output })).toBe(carried);
  });
});

describe("reportOutputInEffect", () => {
  it("is the configured output when no output is requested for the run", () => {
    expect(reportOutputInEffect({ requested: undefined, configured: "counts" })).toBe("counts");
  });

  it.each<[VersionTwoReportOutput, VersionTwoReportOutput]>([
    ["full", "verdict-only"],
    ["actionable", "full"],
    ["counts", "actionable"],
    ["verdict-only", "counts"],
  ])("is the requested %s over the configured %s", (requested, configured) => {
    expect(reportOutputInEffect({ requested, configured })).toBe(requested);
  });

  it("is the requested output when it matches the configured one", () => {
    expect(reportOutputInEffect({ requested: "actionable", configured: "actionable" })).toBe("actionable");
  });
});
