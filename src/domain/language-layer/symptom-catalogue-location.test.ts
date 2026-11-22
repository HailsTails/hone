import { describe, expect, it } from "vitest";
import { CHECK_ITEMS_SEGMENTS, checkItemSegments, SYMPTOM_CATALOGUE_SEGMENTS } from "./symptom-catalogue-location.ts";

describe("SYMPTOM_CATALOGUE_SEGMENTS", () => {
  it("places the catalogue's items in the rule set's rules folder", () => {
    expect(SYMPTOM_CATALOGUE_SEGMENTS).toEqual(["rules"]);
  });
});

describe("CHECK_ITEMS_SEGMENTS", () => {
  it("places the check items under the TypeScript symptoms", () => {
    expect(CHECK_ITEMS_SEGMENTS).toEqual(["rules", "typescript", "symptoms"]);
  });
});

describe("checkItemSegments", () => {
  it("places a check's item in its symptom's folder, named by the check", () => {
    expect(checkItemSegments({ check: { name: "clock-sources", symptom: { name: "date-used-directly" } } })).toEqual([
      "rules",
      "typescript",
      "symptoms",
      "date-used-directly",
      "clock-sources.md",
    ]);
  });
});
