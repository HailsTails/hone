import { describe, expect, it } from "vitest";
import { joinedKey, PROOF_SECTIONS, uniqueKeys } from "./section-keys.ts";

describe("PROOF_SECTIONS", () => {
  it("names every compared section, the verdict last", () => {
    expect(PROOF_SECTIONS).toEqual([
      "excluded",
      "findings",
      "answered",
      "unrecorded",
      "misnamed",
      "paid",
      "stale",
      "forfeited",
      "doubly-held",
      "invalid-records",
      "uncovered",
      "not-adopted",
      "not-run",
      "editions",
      "unmeasured",
      "projection-problems",
      "assessment",
      "verdict",
    ]);
  });
});

describe("uniqueKeys", () => {
  it("keeps each key once, in the order first seen", () => {
    expect(uniqueKeys({ keys: ["b", "a", "b", "c", "a"] })).toEqual(["b", "a", "c"]);
  });
});

describe("joinedKey", () => {
  it("joins its parts with a space, numbers as their digits", () => {
    expect(joinedKey({ parts: ["src/a.ts", 3, "x"] })).toBe("src/a.ts 3 x");
  });
});
