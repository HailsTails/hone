import { describe, expect, it } from "vitest";

import type { Result } from "./result.ts";

describe("Result", () => {
  it("carries a failure as data under the failed outcome", () => {
    const failure: Result<number, { readonly kind: "unreadable" }> = {
      outcome: "failed",
      error: { kind: "unreadable" },
    };
    expect(failure).toEqual({ outcome: "failed", error: { kind: "unreadable" } });
  });
});
