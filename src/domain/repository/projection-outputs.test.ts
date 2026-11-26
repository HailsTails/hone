import { describe, expect, it } from "vitest";

import {
  mapProjectionOutputsToNames,
  projectionOutputNamesOf,
  projectionOutputsOf,
} from "./projection-outputs.ts";

describe("projectionOutputsOf", () => {
  it("names the configuration and its declaration for the mjs kind after the engine", () => {
    const outputs = projectionOutputsOf({ engineName: "eslint", kind: "mjs" });

    expect(outputs).toEqual({
      kind: "mjs",
      configuration: "hone.eslint.mjs",
      declaration: "hone.eslint.d.mts",
    });
  });

  it("names one typed configuration for the ts kind after the engine", () => {
    const outputs = projectionOutputsOf({ engineName: "eslint", kind: "ts" });

    expect(outputs).toEqual({ kind: "ts", configuration: "hone.eslint.ts" });
  });
});

describe("mapProjectionOutputsToNames", () => {
  it("lists the configuration and the declaration of the mjs kind", () => {
    const names = mapProjectionOutputsToNames({
      outputs: {
        kind: "mjs",
        configuration: "hone.eslint.mjs",
        declaration: "hone.eslint.d.mts",
      },
    });

    expect(names).toEqual(["hone.eslint.mjs", "hone.eslint.d.mts"]);
  });

  it("lists the one configuration of the ts kind", () => {
    const names = mapProjectionOutputsToNames({
      outputs: { kind: "ts", configuration: "hone.eslint.ts" },
    });

    expect(names).toEqual(["hone.eslint.ts"]);
  });
});

describe("projectionOutputNamesOf", () => {
  it("lists every file either kind writes for each named engine", () => {
    const names = projectionOutputNamesOf({ engineNames: ["eslint", "walker"] });

    expect(names).toEqual([
      "hone.eslint.mjs",
      "hone.eslint.d.mts",
      "hone.eslint.ts",
      "hone.walker.mjs",
      "hone.walker.d.mts",
      "hone.walker.ts",
    ]);
  });

  it("lists nothing when no engine is named", () => {
    const names = projectionOutputNamesOf({ engineNames: [] });

    expect(names).toEqual([]);
  });
});
