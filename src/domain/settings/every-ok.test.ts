import { describe, expect, it, vi } from "vitest";

import type { Result } from "../result.ts";
import { everyOk } from "./every-ok.ts";

type Resolve = (entry: string) => Result<number, string>;

describe("everyOk", () => {
  it("gives every resolved value, in order, when each entry resolves", () => {
    const resolve = vi
      .fn<Resolve>()
      .mockReturnValueOnce({ outcome: "ok", value: 1 })
      .mockReturnValueOnce({ outcome: "ok", value: 2 });
    expect(everyOk({ entries: ["one", "two"], resolve })).toEqual({ outcome: "ok", value: [1, 2] });
  });

  it("gives an empty list for no entries", () => {
    expect(everyOk({ entries: [], resolve: vi.fn<Resolve>() })).toEqual({
      outcome: "ok",
      value: [],
    });
  });

  it("gives the first failure and resolves nothing after it", () => {
    const resolve = vi
      .fn<Resolve>()
      .mockReturnValueOnce({ outcome: "failed", error: "one is refused" })
      .mockReturnValueOnce({ outcome: "ok", value: 2 });
    expect(everyOk({ entries: ["one", "two"], resolve })).toEqual({
      outcome: "failed",
      error: "one is refused",
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
