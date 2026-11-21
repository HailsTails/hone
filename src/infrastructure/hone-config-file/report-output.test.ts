import { describe, expect, it } from "vitest";
import { reportOutputSchema, versionTwoReportOutputSchema } from "./report-output.ts";

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
