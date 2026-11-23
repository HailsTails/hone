import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { calleeRootOf } from "./syntax-callee-root.ts";

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const { syntaxApi } = loadedParse.value;

describe("calleeRootOf", () => {
  it("finds the root through a tagged table", () => {
    const source = syntaxApi.createSourceFile(
      "input.ts",
      'test.each`name | expected`("test", work);',
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const [statement] = source.statements;
    assert.isDefined(statement);
    assert(syntaxApi.isExpressionStatement(statement));
    const root = calleeRootOf({ syntaxApi, node: statement.expression });
    assert.isDefined(root);
    expect(root.text).toBe("test");
  });

  it("looks through calls, members, non-null assertions and parentheses", () => {
    const source = syntaxApi.createSourceFile(
      "input.ts",
      '(it["each"]!([1]))("test", work);',
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const [statement] = source.statements;
    assert(statement !== undefined && syntaxApi.isExpressionStatement(statement));
    expect(calleeRootOf({ syntaxApi, node: statement.expression })?.text).toBe("it");
  });
});
