import { describe, expect, it } from "vitest";
import { PROOF_SECTIONS } from "./proof-outcome.ts";

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
