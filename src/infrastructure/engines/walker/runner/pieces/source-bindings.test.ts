import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { sourceBindingsOf, sourceValueDeclarationsOf } from "./source-bindings.ts";

const loaded = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loaded.outcome === "ok");
const { parse, syntaxApi } = loaded.value;

describe("sourceBindingsOf", () => {
  it("resolves an import in the parsed file and leaves an ambient call unbound", () => {
    const sourceFile = parse({
      fileName: "src/a.test.ts",
      source: 'import { test } from "vitest";\ntest();\nsuite();',
    });
    const importedCall = sourceFile.statements[1];
    const ambientCall = sourceFile.statements[2];
    assert(importedCall !== undefined && syntaxApi.isExpressionStatement(importedCall));
    assert(ambientCall !== undefined && syntaxApi.isExpressionStatement(ambientCall));
    assert(syntaxApi.isCallExpression(importedCall.expression));
    assert(syntaxApi.isCallExpression(ambientCall.expression));

    const bindings = sourceBindingsOf({ syntaxApi, sourceFile });
    expect(bindings.getSymbolAtLocation(importedCall.expression.expression)?.getName()).toBe(
      "test",
    );
    expect(bindings.getSymbolAtLocation(ambientCall.expression.expression)).toBeUndefined();
  });

  it("resolves the value in a shorthand property instead of the property declaration", () => {
    const sourceFile = parse({
      fileName: "src/a.ts",
      source: "const present = 1;\nconst a = { present };\nconst b = { globalThis };",
    });
    const local = sourceFile.statements[1];
    const ambient = sourceFile.statements[2];
    assert(local !== undefined && syntaxApi.isVariableStatement(local));
    assert(ambient !== undefined && syntaxApi.isVariableStatement(ambient));
    const first = local.declarationList.declarations[0]?.initializer;
    const second = ambient.declarationList.declarations[0]?.initializer;
    assert(first !== undefined && syntaxApi.isObjectLiteralExpression(first));
    assert(second !== undefined && syntaxApi.isObjectLiteralExpression(second));
    const present = first.properties[0];
    const global = second.properties[0];
    assert(present !== undefined && syntaxApi.isShorthandPropertyAssignment(present));
    assert(global !== undefined && syntaxApi.isShorthandPropertyAssignment(global));

    const bindings = sourceBindingsOf({ syntaxApi, sourceFile });
    expect(sourceValueDeclarationsOf({ syntaxApi, bindings, node: present.name })).toEqual([
      expect.objectContaining({ kind: syntaxApi.SyntaxKind.VariableDeclaration }),
    ]);
    expect(sourceValueDeclarationsOf({ syntaxApi, bindings, node: global.name })).toEqual([]);
  });
});
