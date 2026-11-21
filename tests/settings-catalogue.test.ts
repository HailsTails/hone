import { describe, expect, it } from "vitest";
import { checkAt, checksOf } from "../src/domain/language-layer/check-address.ts";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "./settings-catalogue.ts";

describe("SETTINGS_CATALOGUE", () => {
  it("holds one check for the loops clause", () => {
    expect(checksOf({ catalogue: SETTINGS_CATALOGUE, clause: LOOPS_CLAUSE })).toMatchObject([{ name: "loops", symptom: { name: "loop-keyword" } }]);
  });

  it("holds two checks that run together on the test-body clause", () => {
    expect(checksOf({ catalogue: SETTINGS_CATALOGUE, clause: TEST_BODY_CLAUSE })).toMatchObject([
      { name: "test-body", symptom: { name: "loop-keyword" } },
      { name: "test-body", symptom: { name: "rebinding" } },
    ]);
  });

  it("holds the layering clause review-only, with no check", () => {
    expect(checkAt({ catalogue: SETTINGS_CATALOGUE, address: "rebinding#layering" })).toEqual({ found: "none" });
  });
});
