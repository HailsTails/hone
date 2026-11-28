import { describe, expect, it } from "vitest";

import { mapDiagnosticsToTypeErrors } from "./block-diagnostics.ts";

describe("mapDiagnosticsToTypeErrors", () => {
  it("places a diagnostic in the block whose file it names, and keeps one with no file, or in a file that is no block, outside the blocks", () => {
    const block = {
      recipe: "assert-to-narrow",
      anchor: "a-short-circuit",
      position: 1,
      source: "expect(1).toBe(1);\n",
    };

    const errors = mapDiagnosticsToTypeErrors({
      files: [{ block, path: "/repo/recipe-example-0.test.ts" }],
      diagnostics: [
        { path: undefined, message: "option 'strict' is invalid" },
        { path: "/repo/src/imported.ts", message: "broken through an import" },
        { path: "/repo/recipe-example-0.test.ts", message: "Object is possibly 'undefined'." },
      ],
    });

    expect(errors).toEqual([
      { kind: "outside-the-blocks", message: "option 'strict' is invalid" },
      { kind: "outside-the-blocks", message: "/repo/src/imported.ts: broken through an import" },
      { kind: "in-a-block", block, message: "Object is possibly 'undefined'." },
    ]);
  });
});
