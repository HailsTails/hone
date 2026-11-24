import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../../src/infrastructure/content-files/absolute-path.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultFileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { readCheckBindings } from "./check-bindings.ts";
import { createFlaggedFormsPort } from "./flagged-forms.ts";

describe("createFlaggedFormsPort, over the real walker", () => {
  it("names the forms the check's newest edition flags in a block, and no other check's", async () => {
    const fileText = createDefaultFileTextPort({});
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", "..", ".."] }),
    );
    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: repoRoot, installForm: "source" }),
    });
    assert(parse.outcome === "ok", "the typescript line loads from the development install");
    const bindings = readCheckBindings({
      checks: [
        {
          name: "test-body",
          symptom: { name: "branch-in-a-test" },
          engines: [{ name: "walker" }],
        },
        { name: "test-body", symptom: { name: "rebinding" }, engines: [{ name: "walker" }] },
      ],
      repoRoot,
      fileText,
      path,
    });
    assert(bindings.outcome === "ok", "the pieces of the checks read");
    const flaggedForms = createFlaggedFormsPort({
      parse: parse.value,
      repoRoot,
      fileText,
      path,
      bindings: bindings.value,
    });

    const named = await flaggedForms.read({
      source: "declare const a: boolean;\nlet b = a && a;\nif (b) {\n  expect(b).toBe(true);\n}\n",
      check: "branch-in-a-test#test-body",
    });

    expect(named).toEqual({ outcome: "ok", value: ["a-short-circuit", "branching-with-if"] });
  });
});
