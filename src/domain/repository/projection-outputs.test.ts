import { describe, expect, it } from "vitest";

import { projectionOutputNamesOf, projectionOutputsOf } from "./projection-outputs.ts";

describe("projectionOutputsOf", () => {
  it("names every file hone project writes for an engine after that engine", () => {
    expect(projectionOutputsOf({ engineName: "eslint" })).toEqual({
      configuration: "hone.eslint.mjs",
      declaration: "hone.eslint.d.mts",
    });
  });
});

describe("projectionOutputNamesOf", () => {
  it("lists the configuration and the declaration of each named engine", () => {
    expect(projectionOutputNamesOf({ engineNames: ["eslint", "walker"] })).toEqual([
      "hone.eslint.mjs",
      "hone.eslint.d.mts",
      "hone.walker.mjs",
      "hone.walker.d.mts",
    ]);
  });

  it("lists nothing when no engine is named", () => {
    expect(projectionOutputNamesOf({ engineNames: [] })).toEqual([]);
  });
});
