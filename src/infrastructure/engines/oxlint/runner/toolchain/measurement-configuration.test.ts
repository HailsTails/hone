import { describe, expect, it } from "vitest";

import { createMeasurementConfiguration } from "./measurement-configuration.ts";

describe("createMeasurementConfiguration", () => {
  it("sets the selected options and resolves plugin entries from their bindings", () => {
    const config = createMeasurementConfiguration([
      { kind: "native", id: "eslint/max-params", options: [{ max: 2 }] },
      {
        kind: "plugin",
        id: "hone-filenames/filename-case",
        namespace: "hone-filenames",
        module: "/installed/check.mjs",
        options: ["camelCase"],
      },
    ]);

    expect(config).toEqual({
      categories: { correctness: "off" },
      rules: {
        "eslint/max-params": ["error", { max: 2 }],
        "hone-filenames/filename-case": ["error", "camelCase"],
      },
      jsPlugins: [{ name: "hone-filenames", specifier: "/installed/check.mjs" }],
    });
  });
});
