import { describe, expect, it } from "vitest";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "./symptom-catalogue-location.ts";

describe("SYMPTOM_CATALOGUE_SEGMENTS", () => {
  it("places the catalogue's items in the rule set's rules folder", () => {
    expect(SYMPTOM_CATALOGUE_SEGMENTS).toEqual(["rules"]);
  });
});
