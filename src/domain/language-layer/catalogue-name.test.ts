import { describe, expect, it } from "vitest";

import { catalogueNameOf, isCatalogueName } from "./catalogue-name.ts";

describe("catalogue names", () => {
  it("builds a catalogue name from a lowercase dash-separated literal", () => {
    expect(catalogueNameOf("class-keyword")).toBe("class-keyword");
  });

  it.each(["../class-keyword", "ClassKeyword", "class--keyword", "class-keyword/"])(
    "refuses %s as a folder segment",
    (name) => {
      expect(isCatalogueName(name)).toBe(false);
    },
  );
});
