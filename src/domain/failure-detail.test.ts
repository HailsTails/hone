import { describe, expect, it } from "vitest";

import { failureDetailOf } from "./failure-detail.ts";

describe("failureDetailOf", () => {
  it("gives an error's message", () => {
    expect(failureDetailOf({ thrown: new Error("EACCES: permission denied") })).toBe(
      "EACCES: permission denied",
    );
  });

  it("gives anything else thrown as its text", () => {
    expect(failureDetailOf({ thrown: "refused" })).toBe("refused");
  });
});
