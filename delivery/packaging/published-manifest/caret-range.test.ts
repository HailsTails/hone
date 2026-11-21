import { describe, expect, it } from "vitest";
import { caretFitOf, caretRangeOf } from "./caret-range.ts";

describe("caretRangeOf", () => {
  it("reads a caret range of one plain release as its floor", () => {
    expect([caretRangeOf({ range: "^4.6.6" }), caretRangeOf({ range: "^0.7.3" })]).toEqual([
      { outcome: "ok", value: { floor: "4.6.6", major: 4, minor: 6, patch: 6 } },
      { outcome: "ok", value: { floor: "0.7.3", major: 0, minor: 7, patch: 3 } },
    ]);
  });

  it("refuses every range that is not a caret range of one plain release", () => {
    expect([
      caretRangeOf({ range: "4.6.6" }),
      caretRangeOf({ range: "~4.6.6" }),
      caretRangeOf({ range: ">=4.6.6" }),
      caretRangeOf({ range: "*" }),
      caretRangeOf({ range: "^4.x" }),
      caretRangeOf({ range: "^4" }),
      caretRangeOf({ range: "latest" }),
      caretRangeOf({ range: "^4.6.6 || ^5.0.0" }),
      caretRangeOf({ range: "^4.6.6-beta.1" }),
      caretRangeOf({ range: "https://example.com/zod.tgz" }),
    ]).toEqual([
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
      { outcome: "failed", error: "not-caret" },
    ]);
  });
});

describe("caretFitOf", () => {
  const ABOVE_ONE = { floor: "4.6.6", major: 4, minor: 6, patch: 6 };
  const BELOW_ONE = { floor: "0.7.3", major: 0, minor: 7, patch: 3 };
  const PATCH_ONLY = { floor: "0.0.4", major: 0, minor: 0, patch: 4 };

  it("places a release from the floor up to the next major inside a range at or above 1.0.0", () => {
    expect([
      caretFitOf({ range: ABOVE_ONE, version: "4.6.6" }),
      caretFitOf({ range: ABOVE_ONE, version: "4.6.7" }),
      caretFitOf({ range: ABOVE_ONE, version: "4.9.0" }),
      caretFitOf({ range: ABOVE_ONE, version: "4.6.5" }),
      caretFitOf({ range: ABOVE_ONE, version: "4.5.9" }),
      caretFitOf({ range: ABOVE_ONE, version: "5.0.0" }),
      caretFitOf({ range: ABOVE_ONE, version: "4.7.0-beta.1" }),
    ]).toEqual(["within", "within", "within", "outside", "outside", "outside", "outside"]);
  });

  it("keeps a 0.x range inside its minor, and a 0.0.x range at its one patch", () => {
    expect([
      caretFitOf({ range: BELOW_ONE, version: "0.7.3" }),
      caretFitOf({ range: BELOW_ONE, version: "0.7.9" }),
      caretFitOf({ range: BELOW_ONE, version: "0.8.0" }),
      caretFitOf({ range: BELOW_ONE, version: "0.7.2" }),
      caretFitOf({ range: PATCH_ONLY, version: "0.0.4" }),
      caretFitOf({ range: PATCH_ONLY, version: "0.0.5" }),
    ]).toEqual(["within", "within", "outside", "outside", "within", "outside"]);
  });
});
