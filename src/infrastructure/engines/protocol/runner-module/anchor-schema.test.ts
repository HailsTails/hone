import { describe, expect, it } from "vitest";
import { anchorSchema } from "./anchor-schema.ts";

describe("anchorSchema", () => {
  it("accepts a one-based line and a zero-based column", () => {
    expect(anchorSchema.safeParse({ line: 1, column: 0 })).toEqual({ success: true, data: { line: 1, column: 0 } });
  });

  it("refuses line zero", () => {
    expect(anchorSchema.safeParse({ line: 0, column: 0 }).success).toBe(false);
  });

  it("refuses a negative column", () => {
    expect(anchorSchema.safeParse({ line: 1, column: -1 }).success).toBe(false);
  });

  it("refuses a fractional line", () => {
    expect(anchorSchema.safeParse({ line: 1.5, column: 0 }).success).toBe(false);
  });
});
