import { describe, expect, it } from "vitest";
import { assessmentSchema, DEFAULT_ASSESSMENT, forfeitureAssessmentSchema } from "./assessment.ts";

describe("forfeitureAssessmentSchema", () => {
  it.each(["this-run", "elsewhere"])("accepts %s", (forfeiture) => {
    expect(forfeitureAssessmentSchema.safeParse(forfeiture)).toEqual({ success: true, data: forfeiture });
  });

  it.each(["reported", "", "Elsewhere", "skip", true])("refuses %j", (forfeiture) => {
    expect(forfeitureAssessmentSchema.safeParse(forfeiture).success).toBe(false);
  });
});

describe("assessmentSchema", () => {
  it("is the default assessment for an empty object", () => {
    expect(assessmentSchema.parse({})).toEqual(DEFAULT_ASSESSMENT);
  });

  it("assesses forfeiture in this run by default", () => {
    expect(DEFAULT_ASSESSMENT).toEqual({ forfeiture: "this-run" });
  });

  it("reads forfeiture elsewhere", () => {
    expect(assessmentSchema.parse({ forfeiture: "elsewhere" })).toEqual({ forfeiture: "elsewhere" });
  });

  it.each([
    ["eslint", { eslint: { evidence: "hone" } }],
    ["an unknown key", { lint: "skip" }],
  ])("refuses %s, which this release does not assess", (_key, assessment) => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(false);
  });

  it.each([
    ["a forfeiture that is not one of the two", { forfeiture: "reported" }],
    ["a null forfeiture", { forfeiture: null }],
    ["a forfeiture list", { forfeiture: ["elsewhere"] }],
  ])("refuses %s", (_shape, assessment) => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(false);
  });
});

describe("assessmentSchema removed waived clauses", () => {
  it.each(["run", "not-run"])("refuses waivedClauses %s and says how clauses now state it", (waivedClauses) => {
    expect(assessmentSchema.safeParse({ waivedClauses })).toMatchObject({
      success: false,
      error: {
        issues: [
          {
            message:
              'removed: "waivedClauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12',
          },
        ],
      },
    });
  });

  it("names the removed key apart from a key this version does not assess", () => {
    expect(assessmentSchema.safeParse({ waivedClauses: "not-run", eslint: { evidence: "hone" } })).toMatchObject({
      success: false,
      error: {
        issues: [
          {
            message:
              'removed: "waivedClauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12. not available in this version: "eslint"; assessment takes "forfeiture" only',
          },
        ],
      },
    });
  });
});
