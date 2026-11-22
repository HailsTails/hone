import { describe, expect, it } from "vitest";
import { disciplineIdOf } from "./discipline-id-of.ts";
import { isDisciplineId } from "./identifiers.ts";

describe("disciplineIdOf", () => {
  it.each(["CD-14", "CD-2", "ABC-1", "ABCD-10", "CD-14a"] as const)("returns %s unchanged", (text) => {
    expect(disciplineIdOf(text)).toBe(text);
  });

  it("returns text the discipline-id guard accepts", () => {
    expect(isDisciplineId(disciplineIdOf("CD-14"))).toBe(true);
  });
});
