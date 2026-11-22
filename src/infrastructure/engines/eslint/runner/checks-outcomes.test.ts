import { describe, expect, it, vi } from "vitest";

import { mappedOutcome } from "./checks-outcomes.ts";

describe("mappedOutcome", () => {
  it("gives the value of an ok outcome as mapped", () => {
    const map = vi.fn<(count: number) => string>().mockReturnValue("mapped");
    expect(mappedOutcome({ outcome: { outcome: "ok", value: 2 }, map })).toEqual({
      outcome: "ok",
      value: "mapped",
    });
    expect(map.mock.calls).toEqual([[2]]);
  });

  it("gives a failed outcome as it is, mapping nothing", () => {
    const map = vi.fn<(count: number) => string>();
    expect(
      mappedOutcome({
        outcome: { outcome: "failed", error: { kind: "tool-failed", detail: "stopped" } },
        map,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "stopped" },
    });
    expect(map.mock.calls).toEqual([]);
  });
});
