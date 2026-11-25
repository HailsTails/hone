import { assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { readRepositoryImports } from "./source-imports.ts";

describe("readRepositoryImports", () => {
  it("reads this repository's source files with the imports TypeScript finds in each", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );

    const sources = await readRepositoryImports({ repoRoot });

    expect(sources).toEqual({
      outcome: "ok",
      value: expect.arrayContaining([
        { file: "src/domain/result.ts", imports: [] },
        {
          file: "src/domain/gathered-outcomes.ts",
          imports: [
            { specifier: "./result.ts", kind: "import", form: "type-only", names: ["Result"] },
          ],
        },
      ]),
    });
  });

  it("reads them with TypeScript 6", async () => {
    const path = createDefaultPathPort({});
    const repoRoot = absolutePathSchema.parse(
      path.join({ segments: [import.meta.dirname, "..", ".."] }),
    );

    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: repoRoot, installForm: "source" }),
    });

    assert(parse.outcome === "ok", "the typescript line loads from the development install");
    expect(parse.value.syntaxApi.version).toMatch(/^6\./);
  });
});
