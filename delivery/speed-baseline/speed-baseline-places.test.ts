import { describe, expect, it } from "vitest";

import { mapCommitToCheckoutSegments, mapPlaceToSegments } from "./speed-baseline-places.ts";

describe("mapPlaceToSegments", () => {
  it("places each side's install in its own worktree", () => {
    const segments = mapPlaceToSegments({ place: { kind: "install", side: "head" } });

    expect(segments).toEqual([".claude", "worktrees", "hone-speed-head"]);
  });

  it("nests each sample inside its side's install worktree", () => {
    const segments = mapPlaceToSegments({
      place: { kind: "sample", side: "baseline", sampleIndex: 3 },
    });

    expect(segments).toEqual([".claude", "worktrees", "hone-speed-baseline", "samples", "3"]);
  });
});

describe("mapCommitToCheckoutSegments", () => {
  it("names the baseline checkout after its commit", () => {
    const segments = mapCommitToCheckoutSegments({ commit: "31098fa5" });

    expect(segments).toEqual([".claude", "worktrees", "baseline-31098fa5"]);
  });
});
