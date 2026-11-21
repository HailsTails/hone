import { describe, expect, it } from "vitest";
import { type ReportOutput, reportOutputInEffect, reportOutputOfVersionOne, type VersionTwoReportOutput } from "./report-output.ts";

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
