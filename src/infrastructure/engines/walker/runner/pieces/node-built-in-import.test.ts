import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { type BuiltInImport, builtInImportOf, type NodeBuiltIn } from "./node-built-in-import.ts";
import { sourceValueLookupOf } from "./source-bindings.ts";

const loaded = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loaded.outcome === "ok");
const { parse, syntaxApi } = loaded.value;

const importOfLastUse = (request: {
  readonly source: string;
  readonly builtIn: NodeBuiltIn;
}): BuiltInImport | undefined => {
  const sourceFile = parse({ fileName: "src/a.ts", source: request.source });
  const use = sourceFile.statements.at(-1);
  assert.isDefined(use);
  assert(syntaxApi.isExpressionStatement(use));
  return builtInImportOf({
    syntaxApi,
    identifier: use.expression,
    declarationsOf: sourceValueLookupOf({ syntaxApi, sourceFile }),
    builtIn: request.builtIn,
  });
};

describe("builtInImportOf", () => {
  it.each([
    'import nodeCrypto from "node:crypto";\nnodeCrypto;',
    'import { default as nodeCrypto } from "crypto";\nnodeCrypto;',
    'import nodeCrypto = require("crypto");\nnodeCrypto;',
    'const nodeCrypto = require("node:crypto");\nnodeCrypto;',
  ])("names the whole module bound in %s", (source) => {
    expect(importOfLastUse({ source, builtIn: "crypto" })).toEqual({ kind: "module" });
  });

  it("names a namespace import", () => {
    expect(
      importOfLastUse({
        source: 'import * as nodeCrypto from "crypto";\nnodeCrypto;',
        builtIn: "crypto",
      }),
    ).toEqual({ kind: "namespace" });
  });

  it("names the export behind an aliased named import", () => {
    expect(
      importOfLastUse({
        source: 'import { randomUUID as newId } from "node:crypto";\nnewId;',
        builtIn: "crypto",
      }),
    ).toEqual({ kind: "named", name: "randomUUID" });
  });

  it.each([
    'const require = injectedLoader;\nconst nodeCrypto = require("node:crypto");\nnodeCrypto;',
    'import nodeCrypto from "./crypto";\nnodeCrypto;',
    'import nodeCrypto from "node:process";\nnodeCrypto;',
    "const nodeCrypto = provided;\nnodeCrypto;",
    "nodeCrypto;",
  ])("finds no Node crypto binding in %s", (source) => {
    expect(importOfLastUse({ source, builtIn: "crypto" })).toBeUndefined();
  });
});
