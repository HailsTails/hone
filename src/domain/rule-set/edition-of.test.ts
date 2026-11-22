import { describe, expect, it } from "vitest";

import { editionOf } from "./edition-of.ts";
import { isEdition } from "./edition-reach.ts";

describe("editionOf", () => {
  it.each(["1", "2", "10", "123"] as const)("returns %s unchanged", (text) => {
    expect(editionOf(text)).toBe(text);
  });

  it("returns text the edition guard accepts", () => {
    expect(isEdition(editionOf("3"))).toBe(true);
  });
});
