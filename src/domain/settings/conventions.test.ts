import { describe, expect, it } from "vitest";

import { DEFAULT_CONVENTIONS } from "./conventions.ts";

describe("DEFAULT_CONVENTIONS", () => {
  it("holds no generated folders and no layers, and counts .test and .spec files as tests", () => {
    expect(DEFAULT_CONVENTIONS).toEqual({
      generated: [],
      layers: [],
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
  });
});
