import { describe, expect, it } from "vitest";
import { codePointOrder } from "./code-point-order.ts";

describe("the order of two texts by their code points", () => {
  it("puts the lesser first", () => {
    expect(codePointOrder({ left: "a", right: "b" })).toBe(-1);
  });

  it("puts the greater second", () => {
    expect(codePointOrder({ left: "b", right: "a" })).toBe(1);
  });

  it("holds equal texts equal", () => {
    expect(codePointOrder({ left: "a", right: "a" })).toBe(0);
  });

  it("puts an uppercase letter before a lowercase one, as code points do and a locale does not", () => {
    expect(codePointOrder({ left: "Z", right: "a" })).toBe(-1);
  });
});
