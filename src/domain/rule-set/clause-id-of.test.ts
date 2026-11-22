import { describe, expect, it } from "vitest";
import { clauseIdOf } from "./clause-id-of.ts";
import { isClauseId } from "./identifiers.ts";

describe("clauseIdOf", () => {
  it.each(["class-syntax", "a", "cast-expressions2"] as const)("returns %s unchanged", (text) => {
    expect(clauseIdOf(text)).toBe(text);
  });

  it("returns text the clause-id guard accepts", () => {
    expect(isClauseId(clauseIdOf("class-syntax"))).toBe(true);
  });

  it("returns ids usable as map keys by their text", () => {
    expect(new Map([[clauseIdOf("class-syntax"), 1]]).get(clauseIdOf("class-syntax"))).toBe(1);
  });
});
