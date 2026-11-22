import { describe, expect, it } from "vitest";
import { catalogueNameOf, isCatalogueName } from "./catalogue-name.ts";

describe("catalogue names", () => {
  it("builds the declared name without changing its text", () => {
    expect(catalogueNameOf("ambient-randomness")).toBe("ambient-randomness");
  });

  it("accepts a named path segment and refuses a path or a numbered discipline", () => {
    expect(isCatalogueName("direct-call")).toBe(true);
    expect(isCatalogueName("../direct-call")).toBe(false);
    expect(isCatalogueName("CD-17")).toBe(false);
  });
});
