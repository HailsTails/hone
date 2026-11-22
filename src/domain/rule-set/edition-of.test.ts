import { describe, expect, it } from "vitest";
import { editionOf } from "./edition-of.ts";
import { editionReaches, isEdition } from "./edition-reach.ts";

describe("editionOf", () => {
  it.each(["1", "2", "10", "123"] as const)("returns %s unchanged", (text) => {
    expect(editionOf(text)).toBe(text);
  });

  it("returns text the edition guard accepts", () => {
    expect(isEdition(editionOf("3"))).toBe(true);
  });

  it("returns editions ordered by number rather than by text", () => {
    expect(editionReaches({ edition: editionOf("10"), introducedIn: editionOf("9") })).toBe("reached");
  });
});
