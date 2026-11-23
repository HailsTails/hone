import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { vitestImportedNameOf } from "./vitest-import.ts";

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const { syntaxApi } = loadedParse.value;

describe("vitestImportedNameOf", () => {
  it("names default and namespace value imports", () => {
    const source = syntaxApi.createSourceFile(
      "input.ts",
      'import defaults, * as vite from "vitest";',
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const [statement] = source.statements;
    assert.isDefined(statement);
    assert(syntaxApi.isImportDeclaration(statement));
    const clause = statement.importClause;
    assert.isDefined(clause);
    const namespace = clause.namedBindings;
    assert.isDefined(namespace);
    expect(vitestImportedNameOf({ syntaxApi, node: clause })).toBe("default");
    expect(vitestImportedNameOf({ syntaxApi, node: namespace })).toBe("*");
  });

  it.each([
    ['import { assert as verify } from "vitest";', "assert"],
    ['import { type assert } from "vitest";', undefined],
    ['import type { assert } from "vitest";', undefined],
    ['import { assert } from "node:assert";', undefined],
  ])("reads the value import in %s", (text, expected) => {
    const source = syntaxApi.createSourceFile(
      "input.ts",
      text,
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const [statement] = source.statements;
    assert(statement !== undefined && syntaxApi.isImportDeclaration(statement));
    const bindings = statement.importClause?.namedBindings;
    assert(bindings !== undefined && syntaxApi.isNamedImports(bindings));
    const [node] = bindings.elements;
    assert(node !== undefined);
    expect(vitestImportedNameOf({ syntaxApi, node })).toBe(expected);
  });
});
