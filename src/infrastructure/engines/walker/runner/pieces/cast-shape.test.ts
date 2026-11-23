import { assert, describe, expect, it } from "vitest";

import type { SyntaxNode, SyntaxTree } from "../toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import {
  type AnyBearing,
  anyBearingOf,
  assertionOf,
  type CastShape,
  castShapeOf,
  castSnippetAt,
} from "./cast-shape.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const SYNTAX_API = loadedParsePort.value.syntaxApi;

type NodeLocator = (tree: SyntaxTree) => SyntaxNode;

const firstExpression: NodeLocator = (tree) =>
  tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);

const located = (request: {
  readonly source: string;
  readonly nodeAt?: NodeLocator;
}): { readonly tree: SyntaxTree; readonly node: SyntaxNode } => {
  const tree = SYNTAX_API.createSourceFile(
    "src/casts.ts",
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  return { tree, node: (request.nodeAt ?? firstExpression)(tree) };
};

const shapeAt = (request: {
  readonly source: string;
  readonly nodeAt?: NodeLocator;
}): { readonly text: string; readonly shape: CastShape } => {
  const { tree, node } = located(request);
  const assertion = assertionOf({ node, syntaxApi: SYNTAX_API });
  assert(assertion !== undefined);
  return { text: node.getText(tree), shape: castShapeOf({ assertion, syntaxApi: SYNTAX_API }) };
};

describe("assertions", () => {
  it.each<{
    readonly name: string;
    readonly source: string;
    readonly form: "as" | "angle-bracket";
  }>([
    { name: "an as assertion", source: "candidate as Profile;\n", form: "as" },
    { name: "an angle-bracket assertion", source: "<Profile>candidate;\n", form: "angle-bracket" },
  ])("reads $name with its operand and type", ({ source, form }) => {
    const { tree, node } = located({ source });
    const assertion = assertionOf({ node, syntaxApi: SYNTAX_API });

    expect(assertion).toMatchObject({ form });
    expect(assertion?.expression.getText(tree)).toBe("candidate");
    expect(assertion?.type.getText(tree)).toBe("Profile");
  });

  it("reads nothing from a node that is not an assertion", () => {
    const { node } = located({ source: "parse(candidate);\n" });

    expect(assertionOf({ node, syntaxApi: SYNTAX_API })).toBeUndefined();
  });
});

describe("any in an assertion's type", () => {
  it.each<{ readonly source: string; readonly bearing: AnyBearing }>([
    { source: "raw as any;\n", bearing: "any-bearing" },
    { source: "<any>raw;\n", bearing: "any-bearing" },
    { source: "rows.value as Array<any>;\n", bearing: "any-bearing" },
    { source: "raw as Record<string, any>;\n", bearing: "any-bearing" },
    { source: "raw as Map<string, any>;\n", bearing: "any-bearing" },
    { source: "raw as { readonly field: ReadonlyArray<any> };\n", bearing: "any-bearing" },
    { source: "raw as (value: any) => void;\n", bearing: "any-bearing" },
    { source: "raw as unknown;\n", bearing: "any-free" },
    { source: "raw as AnyProfile;\n", bearing: "any-free" },
    { source: "raw as 'any';\n", bearing: "any-free" },
  ])("reads $source as $bearing", ({ source, bearing }) => {
    const { node } = located({ source });
    const assertion = assertionOf({ node, syntaxApi: SYNTAX_API });
    assert(assertion !== undefined);

    expect(anyBearingOf({ typeNode: assertion.type, syntaxApi: SYNTAX_API })).toBe(bearing);
  });
});

describe("cast shapes", () => {
  it.each<{
    readonly name: string;
    readonly source: string;
    readonly nodeAt?: NodeLocator;
    readonly text: string;
    readonly shape: CastShape;
  }>([
    {
      name: "an as const assertion",
      source: "['a'] as const;\n",
      text: "['a'] as const",
      shape: "const-assertion",
    },
    {
      name: "an angle-bracket const assertion",
      source: "<const>['a'];\n",
      text: "<const>['a']",
      shape: "const-assertion",
    },
    {
      name: "an unknown widening",
      source: "candidate as unknown;\n",
      text: "candidate as unknown",
      shape: "unknown-widening",
    },
    {
      name: "an angle-bracket unknown widening",
      source: "<unknown>candidate;\n",
      text: "<unknown>candidate",
      shape: "unknown-widening",
    },
    {
      name: "a cast to a named type",
      source: "candidate as Profile;\n",
      text: "candidate as Profile",
      shape: "type-assertion",
    },
    {
      name: "an angle-bracket cast to a named type",
      source: "<Profile>candidate;\n",
      text: "<Profile>candidate",
      shape: "type-assertion",
    },
    {
      name: "a bare double cast",
      source: "candidate as unknown as Profile;\n",
      text: "candidate as unknown as Profile",
      shape: "through-unknown",
    },
    {
      name: "the inner half of a double cast",
      source: "candidate as unknown as Profile;\n",
      nodeAt: (tree) => firstExpression(tree).getChildAt(0, tree),
      text: "candidate as unknown",
      shape: "unknown-widening",
    },
    {
      name: "a parenthesised double cast",
      source: "((candidate as unknown)) as Profile;\n",
      text: "((candidate as unknown)) as Profile",
      shape: "through-unknown",
    },
    {
      name: "a double cast passed as a call argument",
      source: "parse(candidate as unknown as Profile);\n",
      nodeAt: (tree) => firstExpression(tree).getChildAt(2, tree).getChildAt(0, tree),
      text: "candidate as unknown as Profile",
      shape: "through-unknown",
    },
    {
      name: "a double cast over a property chain",
      source: "(response.body.payload as unknown as Profile).name;\n",
      nodeAt: (tree) => firstExpression(tree).getChildAt(0, tree).getChildAt(1, tree),
      text: "response.body.payload as unknown as Profile",
      shape: "through-unknown",
    },
    {
      name: "an as cast over an angle-bracket widening",
      source: "<unknown>candidate as Profile;\n",
      text: "<unknown>candidate as Profile",
      shape: "through-unknown",
    },
    {
      name: "an angle-bracket cast over an angle-bracket widening",
      source: "<Profile><unknown>candidate;\n",
      text: "<Profile><unknown>candidate",
      shape: "through-unknown",
    },
    {
      name: "a double cast through a non-null assertion",
      source: "(candidate as unknown)! as Profile;\n",
      text: "(candidate as unknown)! as Profile",
      shape: "through-unknown",
    },
    {
      name: "a double cast through repeated non-null assertions",
      source: "((candidate as unknown)!)! as Profile;\n",
      text: "((candidate as unknown)!)! as Profile",
      shape: "through-unknown",
    },
    {
      name: "a double cast through a satisfies check",
      source: "(candidate as unknown satisfies unknown) as Profile;\n",
      text: "(candidate as unknown satisfies unknown) as Profile",
      shape: "through-unknown",
    },
    {
      name: "a const assertion through unknown",
      source: "<const>(<unknown>candidate);\n",
      text: "<const>(<unknown>candidate)",
      shape: "through-unknown",
    },
  ])("reads $name as $shape", ({ source, nodeAt, text, shape }) => {
    expect(shapeAt({ source, nodeAt })).toEqual({ text, shape });
  });
});

describe("JSDoc type assertions", () => {
  const argumentOf = (request: { readonly fileName: string; readonly source: string }) => {
    const tree = SYNTAX_API.createSourceFile(
      request.fileName,
      request.source,
      SYNTAX_API.ScriptTarget.Latest,
      true,
    );
    return { tree, node: firstExpression(tree).getChildAt(2, tree).getChildAt(0, tree) };
  };

  it("reads a parenthesised expression under a JSDoc type tag in a JavaScript file as an assertion", () => {
    const { tree, node } = argumentOf({
      fileName: "src/casts.js",
      source: "use(/** @type {Profile} */ (candidate));\n",
    });
    const assertion = assertionOf({ node, syntaxApi: SYNTAX_API });

    expect(assertion).toMatchObject({ form: "jsdoc" });
    expect(assertion?.expression.getText(tree)).toBe("candidate");
    expect(assertion?.type.getText(tree)).toBe("Profile");
  });

  it.each(["src/casts.ts", "src/casts.mts"])(
    "reads no assertion from the same JSDoc in %s, where the compiler ignores it",
    (fileName) => {
      const { node } = argumentOf({
        fileName,
        source: "use(/** @type {Profile} */ (candidate));\n",
      });

      expect(assertionOf({ node, syntaxApi: SYNTAX_API })).toBeUndefined();
    },
  );

  it("reads no assertion from a parenthesised expression without a type tag", () => {
    const { node } = argumentOf({
      fileName: "src/casts.js",
      source: "use(/** @see Profile */ (candidate));\n",
    });

    expect(assertionOf({ node, syntaxApi: SYNTAX_API })).toBeUndefined();
  });

  it.each<{ readonly type: string; readonly bearing: AnyBearing }>([
    { type: "{any}", bearing: "any-bearing" },
    { type: "{*}", bearing: "any-bearing" },
    { type: "{?}", bearing: "any-bearing" },
    { type: "{Array<*>}", bearing: "any-bearing" },
    { type: "{Profile}", bearing: "any-free" },
    { type: "{?Profile}", bearing: "any-free" },
  ])("reads a JSDoc cast to $type as $bearing", ({ type, bearing }) => {
    const { node } = argumentOf({
      fileName: "src/casts.js",
      source: `use(/** @type ${type} */ (candidate));\n`,
    });
    const assertion = assertionOf({ node, syntaxApi: SYNTAX_API });
    assert(assertion !== undefined);

    expect(anyBearingOf({ typeNode: assertion.type, syntaxApi: SYNTAX_API })).toBe(bearing);
  });

  it.each<{ readonly source: string; readonly shape: CastShape }>([
    { source: "use(/** @type {const} */ (['a']));\n", shape: "const-assertion" },
    { source: "use(/** @type {unknown} */ (candidate));\n", shape: "unknown-widening" },
    { source: "use(/** @type {Profile} */ (candidate));\n", shape: "type-assertion" },
    {
      source: "use(/** @type {Profile} */ (/** @type {unknown} */ (candidate)));\n",
      shape: "through-unknown",
    },
  ])("reads $source as $shape", ({ source, shape }) => {
    const { node } = argumentOf({ fileName: "src/casts.js", source });
    const assertion = assertionOf({ node, syntaxApi: SYNTAX_API });
    assert(assertion !== undefined);

    expect(castShapeOf({ assertion, syntaxApi: SYNTAX_API })).toBe(shape);
  });
});

describe("cast snippets", () => {
  it("reads eighty characters from the cast with line breaks as spaces, marking a cut", () => {
    const tree = SYNTAX_API.createSourceFile(
      "src/casts.ts",
      "x as Row;\nyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\n",
      SYNTAX_API.ScriptTarget.Latest,
      true,
    );

    expect(castSnippetAt({ sourceFile: tree, position: 0 })).toBe(
      "x as Row; yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy…",
    );
  });
});
