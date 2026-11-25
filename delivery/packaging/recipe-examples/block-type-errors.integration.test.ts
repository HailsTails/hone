import { assert, describe, expect, it } from "vitest";

import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { createDefaultTypeErrorsPort } from "./block-type-errors.ts";

describe("createDefaultTypeErrorsPort, over the real TypeScript", () => {
  it("reports an element that may be missing and an optional property given undefined, and nothing for a block that compiles", async () => {
    const repoRoot = createDefaultPathPort({}).join({
      segments: [import.meta.dirname, "..", "..", ".."],
    });
    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: repoRoot, installForm: "source" }),
    });
    assert(parse.outcome === "ok", "the typescript line loads from the development install");
    const indexed = {
      recipe: "assert-to-narrow",
      anchor: "an-index",
      position: 1,
      source:
        'declare const rows: readonly { readonly id: string }[];\nexpect(rows[0].id).toBe("a");\n',
    };
    const optional = {
      recipe: "assert-to-narrow",
      anchor: "an-option",
      position: 1,
      source:
        "const options: { readonly limit?: number } = { limit: undefined };\nexpect(options).toEqual({});\n",
    };
    const whole = {
      recipe: "assert-to-narrow",
      anchor: "whole",
      position: 1,
      source: "declare const count: number;\nexpect(count).toBe(1);\n",
    };

    const errors = createDefaultTypeErrorsPort({ syntaxApi: parse.value.syntaxApi, repoRoot }).read(
      {
        blocks: [indexed, optional, whole],
      },
    );

    expect(errors).toEqual([
      { kind: "in-a-block", block: indexed, message: "Object is possibly 'undefined'." },
      { kind: "in-a-block", block: optional, message: expect.any(String) },
    ]);
  });
});
