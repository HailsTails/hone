import { describe, expect, it } from "vitest";
import {
  clauseIdSchema,
  disciplineIdSchema,
  mechanismIdSchema,
  ruleSetNameSchema,
} from "./identifiers.ts";

describe("ruleSetNameSchema", () => {
  it.each(["probe", "team-rules", "r2"])("accepts %j", (text) => {
    expect(ruleSetNameSchema.safeParse(text).success).toBe(true);
  });

  it.each([
    "",
    "Probe",
    "2rules",
    "-rules",
    "team_rules",
    "team rules",
    "team/rules",
  ])("refuses %j", (text) => {
    expect(ruleSetNameSchema.safeParse(text).success).toBe(false);
  });
});

describe("disciplineIdSchema", () => {
  it.each(["CD-14", "CD-7a", "PD-1", "ABCD-123"])("accepts %j", (text) => {
    expect(disciplineIdSchema.safeParse(text).success).toBe(true);
  });

  it.each([
    "",
    "cd-14",
    "C-14",
    "ABCDE-1",
    "CD-",
    "CD14",
    "CD-14ab",
    "CD-14A",
    "CD-x",
    "CD-14#no-class-syntax",
  ])("refuses %j", (text) => {
    expect(disciplineIdSchema.safeParse(text).success).toBe(false);
  });
});

describe("clauseIdSchema", () => {
  it.each(["no-class-syntax", "no-tmp-files", "a1"])("accepts %j", (text) => {
    expect(clauseIdSchema.safeParse(text).success).toBe(true);
  });

  it.each(["", "No-class", "1st-clause", "-clause", "no_class", "no class", "no#class"])(
    "refuses %j",
    (text) => {
      expect(clauseIdSchema.safeParse(text).success).toBe(false);
    },
  );
});

describe("mechanismIdSchema", () => {
  it("refuses not-run, which disciplines.json reserves for a clause adopted with its mechanism not run", () => {
    expect(mechanismIdSchema.safeParse("not-run")).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ message: expect.stringContaining("\"not-run\" is reserved for a clause adopted with its mechanism not run") })] },
    });
  });

  it("refuses not-adopted, which disciplines.json reserves for a clause a repository does not adopt", () => {
    expect(mechanismIdSchema.safeParse("not-adopted")).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ message: expect.stringContaining("reserved for a clause a repository does not adopt") })] },
    });
  });

  it.each(["audit", "eslint", "oxlint2"])("accepts %j", (text) => {
    expect(mechanismIdSchema.safeParse(text).success).toBe(true);
  });

  it.each(["", "ESLint", "2walker", "-walker", "type_script", "es lint", "audit/ts"])(
    "refuses %j",
    (text) => {
      expect(mechanismIdSchema.safeParse(text).success).toBe(false);
    },
  );
});
