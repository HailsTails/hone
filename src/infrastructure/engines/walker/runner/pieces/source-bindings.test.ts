import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import {
  runtimeDeclarationsOf,
  sourceBindingsOf,
  sourceValueDeclarationsOf,
  sourceValueLookupOf,
} from "./source-bindings.ts";

const loaded = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loaded.outcome === "ok");
const { parse, syntaxApi } = loaded.value;

describe("runtimeDeclarationsOf", () => {
  it("treats declarations from a TypeScript declaration file as ambient", () => {
    const sourceFile = parse({
      fileName: "src/runtime.d.ts",
      source: "export const port: object;",
    });
    expect(runtimeDeclarationsOf({ syntaxApi, declarations: sourceFile.statements })).toEqual([]);
  });

  it("retains declarations that supply local values", () => {
    const sourceFile = parse({
      fileName: "src/a.ts",
      source: "declare const ambient: string;\nconst local = 1;",
    });
    const [ambientStatement, localStatement] = sourceFile.statements;
    assert.isDefined(ambientStatement);
    assert(syntaxApi.isVariableStatement(ambientStatement));
    assert.isDefined(localStatement);
    assert(syntaxApi.isVariableStatement(localStatement));
    const [ambient] = ambientStatement.declarationList.declarations;
    const [local] = localStatement.declarationList.declarations;
    assert.isDefined(ambient);
    assert.isDefined(local);
    expect(runtimeDeclarationsOf({ syntaxApi, declarations: [ambient, local] })).toEqual([local]);
  });
});

describe("sourceValueLookupOf", () => {
  it.each([
    'import type { console } from "./ports";\nconsole();',
    'import { type console } from "./ports";\nconsole();',
    'import type console = require("./ports");\nconsole();',
  ])("ignores the type-only binding in %s", (source) => {
    const sourceFile = parse({ fileName: "src/a.ts", source });
    const use = sourceFile.statements[1];
    assert.isDefined(use);
    assert(syntaxApi.isExpressionStatement(use));
    assert(syntaxApi.isCallExpression(use.expression));
    const lookup = sourceValueLookupOf({ syntaxApi, sourceFile });
    expect(lookup(use.expression.expression)).toEqual([]);
  });

  it.each([
    "interface console {}\nconst console = available;\nconsole();",
    "type console = object;\nconst console = available;\nconsole();",
  ])("retains the local value beside %s", (source) => {
    const sourceFile = parse({
      fileName: "src/a.ts",
      source,
    });
    const bindingStatement = sourceFile.statements[1];
    const use = sourceFile.statements[2];
    assert.isDefined(bindingStatement);
    assert(syntaxApi.isVariableStatement(bindingStatement));
    assert.isDefined(use);
    assert(syntaxApi.isExpressionStatement(use));
    assert(syntaxApi.isCallExpression(use.expression));
    const lookup = sourceValueLookupOf({ syntaxApi, sourceFile });
    expect(lookup(use.expression.expression)).toEqual([
      bindingStatement.declarationList.declarations[0],
    ]);
  });
});

describe("sourceBindingsOf", () => {
  it("resolves an import in the parsed file and leaves an ambient call unbound", () => {
    const sourceFile = parse({
      fileName: "src/a.test.ts",
      source: 'import { test } from "vitest";\ntest();\nsuite();',
    });
    const importedCall = sourceFile.statements[1];
    const ambientCall = sourceFile.statements[2];
    assert.isDefined(importedCall);
    assert(syntaxApi.isExpressionStatement(importedCall));
    assert.isDefined(ambientCall);
    assert(syntaxApi.isExpressionStatement(ambientCall));
    assert(syntaxApi.isCallExpression(importedCall.expression));
    assert(syntaxApi.isCallExpression(ambientCall.expression));

    const bindings = sourceBindingsOf({ syntaxApi, sourceFile });
    const imported = bindings.getSymbolAtLocation(importedCall.expression.expression);
    assert.isDefined(imported);
    expect(imported.getName()).toBe("test");
    expect(bindings.getSymbolAtLocation(ambientCall.expression.expression)).toBeUndefined();
  });

  it("resolves the value in a shorthand property instead of the property declaration", () => {
    const sourceFile = parse({
      fileName: "src/a.ts",
      source: "const present = 1;\nconst a = { present };\nconst b = { globalThis };",
    });
    const local = sourceFile.statements[1];
    const ambient = sourceFile.statements[2];
    assert.isDefined(local);
    assert(syntaxApi.isVariableStatement(local));
    assert.isDefined(ambient);
    assert(syntaxApi.isVariableStatement(ambient));
    const [localDeclaration] = local.declarationList.declarations;
    const [ambientDeclaration] = ambient.declarationList.declarations;
    assert.isDefined(localDeclaration);
    assert.isDefined(ambientDeclaration);
    const first = localDeclaration.initializer;
    const second = ambientDeclaration.initializer;
    assert.isDefined(first);
    assert(syntaxApi.isObjectLiteralExpression(first));
    assert.isDefined(second);
    assert(syntaxApi.isObjectLiteralExpression(second));
    const present = first.properties[0];
    const global = second.properties[0];
    assert.isDefined(present);
    assert(syntaxApi.isShorthandPropertyAssignment(present));
    assert.isDefined(global);
    assert(syntaxApi.isShorthandPropertyAssignment(global));

    const bindings = sourceBindingsOf({ syntaxApi, sourceFile });
    expect(sourceValueDeclarationsOf({ syntaxApi, bindings, node: present.name })).toEqual([
      expect.objectContaining({ kind: syntaxApi.SyntaxKind.VariableDeclaration }),
    ]);
    expect(sourceValueDeclarationsOf({ syntaxApi, bindings, node: global.name })).toEqual([]);
  });
});
