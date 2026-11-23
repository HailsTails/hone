import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { parameterBinding } from "./parameter-binding.ts";

const loaded = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loaded.outcome === "ok");
const { parse, syntaxApi } = loaded.value;

describe("parameterBinding", () => {
  it.each([
    { name: "crypto", expected: "local" },
    { name: "Math", expected: "unbound" },
  ])("reads the scope of $name beneath a destructured parameter", ({ name, expected }) => {
    const tree = parse({
      fileName: "src/random.ts",
      source: "function pick({ crypto }: Randomness) { return crypto.randomUUID(); }",
    });
    const [declaration] = tree.statements;
    assert(declaration !== undefined && syntaxApi.isFunctionDeclaration(declaration));
    const statement = declaration.body?.statements[0];
    assert.isDefined(statement);
    expect(parameterBinding({ syntaxApi, node: statement, name })).toBe(expected);
  });
});
