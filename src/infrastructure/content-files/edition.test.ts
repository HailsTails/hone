import { describe, expect, it } from "vitest";
import { clauseEditionsSchema, editionSchema, FIRST_EDITION } from "./edition.ts";

describe("editionSchema", () => {
  it.each(["1", "2", "10"])("accepts %j", (text) => {
    expect(editionSchema.safeParse(text)).toEqual({ success: true, data: text });
  });

  it.each(["", "0", "01", "1.0", "v2", "latest", 2])("refuses %j", (text) => {
    expect(editionSchema.safeParse(text).success).toBe(false);
  });
});

describe("FIRST_EDITION", () => {
  it("names the first edition", () => {
    expect(FIRST_EDITION).toBe("1");
  });
});

describe("clauseEditionsSchema", () => {
  it("is the first edition alone when a piece declares none", () => {
    expect(clauseEditionsSchema.parse(undefined)).toEqual({ declared: ["1"], default: "1", latest: "1" });
  });

  it("defaults to the first declared edition and reaches the last", () => {
    expect(clauseEditionsSchema.parse(["1", "2", "3"])).toEqual({ declared: ["1", "2", "3"], default: "1", latest: "3" });
  });

  it("keeps a single declared edition as both default and latest", () => {
    expect(clauseEditionsSchema.parse(["2"])).toEqual({ declared: ["2"], default: "2", latest: "2" });
  });

  it.each([
    { name: "empty", editions: [] },
    { name: "descending", editions: ["2", "1"] },
    { name: "repeated", editions: ["1", "1"] },
    { name: "numerically unordered", editions: ["2", "10", "3"] },
    { name: "malformed", editions: ["1", "two"] },
  ])("refuses a $name list", ({ editions }) => {
    expect(clauseEditionsSchema.safeParse(editions).success).toBe(false);
  });
});
