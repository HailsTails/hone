import { describe, expect, it } from "vitest";

import { createChecksProjectionOutputs } from "./projection-kinds.ts";

describe("createChecksProjectionOutputs", () => {
  it("names hone.eslint.mjs and its declaration for the mjs kind", () => {
    const outputs = createChecksProjectionOutputs({ kind: "mjs" });

    expect(outputs).toEqual({
      kind: "mjs",
      configuration: "hone.eslint.mjs",
      declaration: "hone.eslint.d.mts",
    });
  });

  it("names hone.eslint.ts alone for the ts kind", () => {
    const outputs = createChecksProjectionOutputs({ kind: "ts" });

    expect(outputs).toEqual({ kind: "ts", configuration: "hone.eslint.ts" });
  });
});
