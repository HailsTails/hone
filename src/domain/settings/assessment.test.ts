import { describe, expect, it } from "vitest";
import { type Assessment, assessmentInEffect, type ForfeitureAssessment } from "./assessment.ts";

describe("assessmentInEffect", () => {
  it("is the configured assessment when no forfeiture is requested for the run", () => {
    expect(assessmentInEffect({ requested: { forfeiture: undefined }, configured: { forfeiture: "elsewhere" } })).toEqual({
      forfeiture: "elsewhere",
    });
  });

  it.each<[ForfeitureAssessment, ForfeitureAssessment]>([
    ["this-run", "elsewhere"],
    ["elsewhere", "this-run"],
    ["elsewhere", "elsewhere"],
  ])("is the requested forfeiture %s over the configured %s", (requested, configured) => {
    const expected: Assessment = { forfeiture: requested };

    expect(assessmentInEffect({ requested: { forfeiture: requested }, configured: { forfeiture: configured } })).toEqual(expected);
  });
});
