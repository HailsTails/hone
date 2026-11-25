import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultFileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { BLOCK_FLAGS } from "./block-flags.ts";
import { readCheckBindings } from "./check-bindings.ts";

describe("BLOCK_FLAGS, over the real walker and ESLint", () => {
  it("flags a block under each engine's check that sees it, and not under the others, putting a block inside a test for the check on assertion sites", async () => {
    const fileText = createDefaultFileTextPort({});
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", "..", ".."] }),
    );
    const bindings = readCheckBindings({
      checks: [
        {
          name: "loop-statement",
          symptom: { name: "loop-keyword" },
          engines: [{ name: "walker" }],
        },
        {
          name: "assertion-site",
          symptom: { name: "assertion-outside-a-test-body" },
          engines: [{ name: "walker" }],
        },
        {
          name: "explicit-any",
          symptom: { name: "untyped-value" },
          engines: [{ name: "eslint" }],
        },
      ],
      repoRoot,
      fileText,
      path,
    });
    assert(bindings.outcome === "ok", "the pieces of the checks read");
    const loop = {
      recipe: "assert-to-narrow",
      anchor: "a-loop",
      position: 1,
      source:
        'declare const rows: readonly string[];\nfor (const row of rows) {\n  expect(row).toBe("a");\n}\n',
    };
    const untyped = {
      recipe: "assert-to-narrow",
      anchor: "an-any",
      position: 1,
      source: "declare const row: any;\nexpect(row).toBe(1);\n",
    };
    const clean = {
      recipe: "assert-to-narrow",
      anchor: "clean",
      position: 1,
      source: "expect(1).toBe(1);\n",
    };

    const flags = await BLOCK_FLAGS.read({
      bindings: bindings.value,
      blocks: [loop, untyped, clean],
    });

    expect(flags).toEqual({
      outcome: "ok",
      value: [
        { block: loop, check: "loop-keyword#loop-statement", lines: [3] },
        { block: untyped, check: "untyped-value#explicit-any", lines: [2] },
      ],
    });
  });
});
