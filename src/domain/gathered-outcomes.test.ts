import { describe, expect, it } from "vitest";
import { gatheredOutcomes, listedOutcome } from "./gathered-outcomes.ts";
import type { Result } from "./result.ts";

type Listed = Result<readonly number[], string>;

describe("gatheredOutcomes", () => {
  it("is an empty ok list for no outcomes", () => {
    expect(gatheredOutcomes<number, string>({ outcomes: [] })).toEqual({ outcome: "ok", value: [] });
  });

  it("concatenates ok lists in order", () => {
    const outcomes: readonly Listed[] = [
      { outcome: "ok", value: [1, 2] },
      { outcome: "ok", value: [] },
      { outcome: "ok", value: [3] },
    ];
    expect(gatheredOutcomes({ outcomes })).toEqual({ outcome: "ok", value: [1, 2, 3] });
  });

  it("is the first failure when several fail", () => {
    const outcomes: readonly Listed[] = [
      { outcome: "ok", value: [1] },
      { outcome: "failed", error: "first" },
      { outcome: "failed", error: "second" },
    ];
    expect(gatheredOutcomes({ outcomes })).toEqual({ outcome: "failed", error: "first" });
  });
});

describe("listedOutcome", () => {
  it("lists an ok value as a one-entry ok list", () => {
    expect(listedOutcome<number, string>({ outcome: { outcome: "ok", value: 3 } })).toEqual({ outcome: "ok", value: [3] });
  });

  it("passes a failure through unchanged", () => {
    expect(listedOutcome<number, string>({ outcome: { outcome: "failed", error: "unreadable" } })).toEqual({
      outcome: "failed",
      error: "unreadable",
    });
  });
});
