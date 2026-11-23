import { assert, describe, expect, it } from "vitest";

import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { outermostParenthesesOf, withoutParentheses } from "./syntax-parentheses.ts";

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const { syntaxApi } = loadedParse.value;

describe("syntax parentheses", () => {
  it("steps between a nested expression and its outermost parentheses", () => {
    const source = syntaxApi.createSourceFile(
      "input.ts",
      "((readOrder()));",
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const [statement] = source.statements;
    assert(statement !== undefined && syntaxApi.isExpressionStatement(statement));
    const outer = statement.expression;
    const unwrapped = withoutParentheses({ syntaxApi, node: outer });
    expect(unwrapped.getText(source)).toBe("readOrder()");
    expect(outermostParenthesesOf({ syntaxApi, node: unwrapped })).toBe(outer);
  });
});
