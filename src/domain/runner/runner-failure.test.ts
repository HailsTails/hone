import { describe, expect, it } from "vitest";

import { rejectedCall, runnerInvalidOutput } from "./runner-failure.ts";

describe("runnerInvalidOutput", () => {
  it("is a failed runner-invalid-output carrying the detail it is given", () => {
    expect(runnerInvalidOutput({ detail: "x" })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "x" },
    });
  });
});

describe("rejectedCall", () => {
  it("is runner-invalid-output naming the message of a thrown Error", () => {
    expect(rejectedCall({ thrown: new Error("boom") })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: boom" },
    });
  });

  it("is runner-invalid-output naming the text of a thrown value that is not an Error", () => {
    expect(rejectedCall({ thrown: 7 })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: 7" },
    });
  });
});
