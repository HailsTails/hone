import { describe, expect, expectTypeOf, it } from "vitest";
import type { Result } from "./result.ts";

describe("Result", () => {
  it("is exactly the ok-or-failed union", () => {
    expectTypeOf<Result<number, string>>().toEqualTypeOf<
      | { readonly outcome: "ok"; readonly value: number }
      | { readonly outcome: "failed"; readonly error: string }
    >();
  });

  it("carries a failure as data under the failed outcome", () => {
    const failure: Result<number, { readonly kind: "unreadable" }> = {
      outcome: "failed",
      error: { kind: "unreadable" },
    };
    expect(failure).toEqual({ outcome: "failed", error: { kind: "unreadable" } });
  });
});
