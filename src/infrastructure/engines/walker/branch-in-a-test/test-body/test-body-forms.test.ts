import { assert, describe, expect, it } from "vitest";

import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import {
  declarationsOf,
  TEST_BODY_REMEDIES,
  TEST_BODY_SECTIONS,
  type TestBodyForm,
  testBodyFormOf,
} from "./test-body-logic.ts";

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

const formOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): TestBodyForm | undefined =>
  testBodyFormOf({
    ...request,
    ownPackageNames: ["@app/paths"],
    declarations: declarationsOf({
      syntaxApi: request.syntaxApi,
      sourceFile: request.node.getSourceFile(),
    }),
  });

type NodeSearch = {
  readonly syntaxApi: SyntaxApi;
  readonly start: number;
  readonly kind: number;
};

const outermostAt = (
  request: NodeSearch & { readonly node: SyntaxNode },
): SyntaxNode | undefined => {
  if (request.node.kind === request.kind && request.node.getStart() === request.start)
    return request.node;
  return request.syntaxApi.forEachChild(request.node, (child) =>
    outermostAt({ ...request, node: child }),
  );
};

const syntaxNodeOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly source: string;
  readonly text: string;
  readonly kind: number;
}): SyntaxNode | undefined => {
  const tree = request.syntaxApi.createSourceFile(
    "node.test.ts",
    request.source,
    request.syntaxApi.ScriptTarget.Latest,
    true,
  );
  return outermostAt({
    syntaxApi: request.syntaxApi,
    start: request.source.indexOf(request.text),
    kind: request.kind,
    node: tree,
  });
};

const firstStatementOf = (request: { readonly source: string }): SyntaxNode =>
  SYNTAX_API.createSourceFile("form.test.ts", request.source, SYNTAX_API.ScriptTarget.Latest, true)
    .getChildAt(0)
    .getChildAt(0);

const firstExpressionOf = (request: { readonly source: string }): SyntaxNode =>
  firstStatementOf(request).getChildAt(0);

const STATEMENT_FORMS = [
  { name: "an if statement", source: "if (ok) {}", edition: "1", section: "branching-with-if" },
  { name: "a try statement", source: "try {} catch {}", edition: "1", section: "a-try-block" },
  { name: "a let statement", source: "let total = 1;", edition: "1", section: "a-let" },
  { name: "a switch statement", source: "switch (kind) {}", edition: "2", section: "a-switch" },
];

const EXPRESSION_FORMS = [
  { name: "a ternary", source: "ok ? 1 : 2;", edition: "1", section: "a-ternary" },
  {
    name: "find",
    source: "rows.find(isFirst);",
    edition: "1",
    section: "a-method-that-picks-or-tests-an-element",
  },
  {
    name: "at",
    source: "rows.at(0);",
    edition: "1",
    section: "a-method-that-picks-or-tests-an-element",
  },
  {
    name: "includes",
    source: "rows.includes(row);",
    edition: "1",
    section: "a-method-that-picks-or-tests-an-element",
  },
  {
    name: "map",
    source: "rows.map(idOf);",
    edition: "1",
    section: "a-method-that-computes-a-value",
  },
  {
    name: "join",
    source: 'parts.join(",");',
    edition: "1",
    section: "a-method-that-computes-a-value",
  },
  { name: "push", source: "rows.push(row);", edition: "1", section: "a-method-that-mutates" },
  { name: "fill", source: "rows.fill(0);", edition: "1", section: "a-method-that-mutates" },
  { name: "a nullish fallback", source: "given ?? 1;", edition: "2", section: "a-short-circuit" },
  { name: "a logical and", source: "left && right;", edition: "2", section: "a-short-circuit" },
  {
    name: "a logical or assignment",
    source: "given ||= 1;",
    edition: "2",
    section: "a-short-circuit",
  },
  {
    name: "an optional property after an index",
    source: "tasks[0]?.id;",
    edition: "2",
    section: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional element after an index",
    source: "rows[0]?.[1];",
    edition: "2",
    section: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional chain on a mock call",
    source: "run.mock.calls[0]?.[0];",
    edition: "2",
    section: "an-optional-chain-on-a-mock-call",
  },
  {
    name: "an optional chain on a mock result",
    source: "run.mock.results[0]?.value;",
    edition: "2",
    section: "an-optional-chain-on-a-mock-result",
  },
  {
    name: "an optional chain on a mock's last call",
    source: "run.mock.lastCall?.[0];",
    edition: "2",
    section: "an-optional-chain-on-a-mock-call",
  },
  {
    name: "an optional chain on a mock instance",
    source: "Store.mock.instances[0]?.rows;",
    edition: "2",
    section: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional chain on a mock context",
    source: "run.mock.contexts[0]?.name;",
    edition: "2",
    section: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional property",
    source: "result.value?.name;",
    edition: "2",
    section: "an-optional-chain-on-a-property",
  },
  {
    name: "an optional call",
    source: "observers.enter?.();",
    edition: "2",
    section: "an-optional-call",
  },
  {
    name: "an optional call of a computing method",
    source: "rows.map?.(idOf);",
    edition: "1",
    section: "a-method-that-computes-a-value",
  },
  {
    name: "Object.keys",
    source: "Object.keys(value);",
    edition: "1",
    section: "a-method-that-computes-a-value",
  },
  {
    name: "JSON.stringify",
    source: "JSON.stringify(value);",
    edition: "2",
    section: "serialising-or-parsing-json",
  },
  {
    name: "JSON.parse",
    source: "JSON.parse(text);",
    edition: "2",
    section: "serialising-or-parsing-json",
  },
  {
    name: "Object.assign",
    source: "Object.assign(target, source);",
    edition: "2",
    section: "merging-objects",
  },
  {
    name: "Object.fromEntries",
    source: "Object.fromEntries(pairs);",
    edition: "2",
    section: "building-an-object-from-entries",
  },
  {
    name: "Array.from",
    source: "Array.from({ length: 3 });",
    edition: "2",
    section: "building-an-array-from-a-length",
  },
  { name: "a Math method", source: "Math.max(a, b);", edition: "2", section: "a-math-call" },
];

const PLAIN_EXPRESSIONS = [
  { name: "element access", source: "rows[0];" },
  { name: "a free call", source: "build(rows);" },
  { name: "a computed method call", source: 'rows["map"](idOf);' },
  { name: "an assert.isDefined call", source: "assert.isDefined(first);" },
  { name: "a toMatchObject call", source: 'expect(first).toMatchObject({ id: "a" });' },
  { name: "an unlisted JSON method", source: "JSON.rawJSON(text);" },
  { name: "an unlisted Object method", source: "Object.freeze(value);" },
];

describe("testBodyFormOf", () => {
  it.each(STATEMENT_FORMS)(
    "names $name as introduced in edition $edition with the $section fix",
    ({ source, edition, section }) => {
      expect(formOf({ syntaxApi: SYNTAX_API, node: firstStatementOf({ source }) })).toMatchObject({
        introducedIn: edition,
        remedy: { section },
      });
    },
  );

  it.each(EXPRESSION_FORMS)(
    "names $name as introduced in edition $edition with the $section fix",
    ({ source, edition, section }) => {
      expect(formOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source }) })).toMatchObject({
        introducedIn: edition,
        remedy: { section },
      });
    },
  );

  it.each(PLAIN_EXPRESSIONS)("names no form for $name", ({ source }) => {
    expect(formOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source }) })).toBeUndefined();
  });

  it("names no form for a const statement", () => {
    expect(
      formOf({
        syntaxApi: SYNTAX_API,
        node: firstStatementOf({ source: "const total = 1;" }),
      }),
    ).toBeUndefined();
  });

  it("attaches advice to the optional-chain form for an indexed element", () => {
    expect(
      formOf({
        syntaxApi: SYNTAX_API,
        node: firstExpressionOf({ source: "tasks[0]?.id;" }),
      }),
    ).toEqual({
      introducedIn: "2",
      remedy: {
        fix: "Optional access hides whether the expected element exists. Assert that the collection contains the required element and its relevant contents.",
        page: "branch-in-a-test/test-body.md",
        section: "an-optional-chain-after-an-index",
      },
    });
  });
});

describe("TEST_BODY_SECTIONS", () => {
  it("lists each check item section a finding can name, once, in the order the forms are written", () => {
    expect(TEST_BODY_SECTIONS).toEqual([
      "branching-with-if",
      "a-try-block",
      "a-ternary",
      "a-let",
      "a-method-that-picks-or-tests-an-element",
      "a-method-that-computes-a-value",
      "a-method-that-mutates",
      "a-short-circuit",
      "an-optional-chain-after-an-index",
      "an-optional-chain-on-a-mock-call",
      "an-optional-chain-on-a-mock-result",
      "an-optional-chain-on-a-property",
      "an-optional-call",
      "a-switch",
      "serialising-or-parsing-json",
      "merging-objects",
      "building-an-object-from-entries",
      "building-an-array-from-a-length",
      "a-math-call",
      "logic-inside-a-function-the-test-passes-on",
    ]);
  });
});

describe("TEST_BODY_REMEDIES", () => {
  it("gives each section its written-out remedy and check item", () => {
    expect(TEST_BODY_REMEDIES).toEqual([
      {
        fix: "The test branches because the unit can return more than one shape. Give each outcome its own test or make the return type express the one outcome callers can rely on.",
        page: "branch-in-a-test/test-body.md",
        section: "branching-with-if",
      },
      {
        fix: "Catching inside the test can let it pass when no error occurs. Assert the failure the caller should observe, whether it is returned or thrown.",
        page: "throw-or-catch-in-a-test/try-block.md",
        section: "a-try-block",
      },
      {
        fix: "The test chooses between values at runtime. State the expected value for each case so the assertion cannot adapt to the result.",
        page: "branch-in-a-test/test-body.md",
        section: "a-ternary",
      },
      {
        fix: "A reassigned local makes the test depend on hidden state. Keep the expected values fixed and assert the interaction you need to observe.",
        page: "rebinding/test-body.md",
        section: "a-let",
      },
      {
        fix: "Selecting an element can discard data the caller should see. Assert the relevant membership or structure of the returned collection directly.",
        page: "computed-value-in-a-test/test-body.md",
        section: "a-method-that-picks-or-tests-an-element",
      },
      {
        fix: "Computing the expectation can repeat the mistake in the implementation. Write the expected value or the relevant properties explicitly.",
        page: "computed-value-in-a-test/test-body.md",
        section: "a-method-that-computes-a-value",
      },
      {
        fix: "Mutating the expected collection obscures its final state. State the finished collection so the reader can see what should be returned.",
        page: "computed-value-in-a-test/test-body.md",
        section: "a-method-that-mutates",
      },
      {
        fix: "Short-circuiting lets the test skip a case when the unit returns an optional or falsy value. Make required output explicit in the unit's type or test each outcome separately.",
        page: "branch-in-a-test/test-body.md",
        section: "a-short-circuit",
      },
      {
        fix: "Optional access hides whether the expected element exists. Assert that the collection contains the required element and its relevant contents.",
        page: "branch-in-a-test/test-body.md",
        section: "an-optional-chain-after-an-index",
      },
      {
        fix: "Optional access hides whether the dependency was called. Assert the expected call and its arguments.",
        page: "branch-in-a-test/test-body.md",
        section: "an-optional-chain-on-a-mock-call",
      },
      {
        fix: "Optional access hides whether the dependency returned a value. Assert the return from the expected call.",
        page: "branch-in-a-test/test-body.md",
        section: "an-optional-chain-on-a-mock-result",
      },
      {
        fix: "The returned object can omit a property the caller needs. Make that property required in the unit's return type or test its absence as a separate outcome.",
        page: "branch-in-a-test/test-body.md",
        section: "an-optional-chain-on-a-property",
      },
      {
        fix: "The unit's output makes the function optional, so callers cannot count on being able to call it. Make the function required in the return type or test the absent case separately.",
        page: "branch-in-a-test/test-body.md",
        section: "an-optional-call",
      },
      {
        fix: "The test branches on a value and can omit assertions for unexpected cases. State the expected outcome for each case separately.",
        page: "branch-in-a-test/test-body.md",
        section: "a-switch",
      },
      {
        fix: "Serializing or parsing inside the test can obscure the returned structure. Assert the object the caller needs and leave its wire format to the boundary adapter.",
        page: "text-past-its-reader/test-body.md",
        section: "serialising-or-parsing-json",
      },
      {
        fix: "Building the expected object by mutation obscures its final shape. State the fields the caller should see and make any copied fields explicit.",
        page: "computed-value-in-a-test/test-body.md",
        section: "merging-objects",
      },
      {
        fix: "Building the expected object from entries hides the shape the assertion promises. Write out the relevant fields and values.",
        page: "computed-value-in-a-test/test-body.md",
        section: "building-an-object-from-entries",
      },
      {
        fix: "Generating the expected array hides the sequence being asserted. State the relevant elements, length, or ordering directly.",
        page: "computed-value-in-a-test/test-body.md",
        section: "building-an-array-from-a-length",
      },
      {
        fix: "Calculating the expected number can reproduce the implementation's error. State the expected number directly.",
        page: "computed-value-in-a-test/test-body.md",
        section: "a-math-call",
      },
      {
        fix: "A callback with its own logic makes the test depend on a second implementation. Give the collaborator a fixed answer and assert how it was used.",
        page: "double-with-a-body/logic-in-a-passed-function.md",
        section: "logic-inside-a-function-the-test-passes-on",
      },
    ]);
  });
});

const CALL = SYNTAX_API.SyntaxKind.CallExpression;

const DOUBLE_SITES = [
  {
    name: "a callback passed to the unit",
    source: "runWith(() => rows.map(idOf));",
    text: "rows.map",
    kind: CALL,
    edition: "1",
  },
  {
    name: "an arrow property",
    source: "const port = { isFile: (path) => files.includes(path) };",
    text: "files.includes",
    kind: CALL,
    edition: "1",
  },
  {
    name: "a method",
    source: "const port = { isFile(path) { return files.includes(path); } };",
    text: "files.includes",
    kind: CALL,
    edition: "1",
  },
  {
    name: "a function expression property",
    source: 'const port = { read: function () { return given ?? ""; } };',
    text: "given ??",
    kind: SYNTAX_API.SyntaxKind.BinaryExpression,
    edition: "2",
  },
  {
    name: "a double passed inline",
    source: 'run({ fileKind: { isFile: (path) => path.endsWith(".ts") } });',
    text: "path.endsWith",
    kind: CALL,
    edition: "1",
  },
  {
    name: "a branch inside a method",
    source: "const port = { read(path) { if (path) {} } };",
    text: "if (path)",
    kind: SYNTAX_API.SyntaxKind.IfStatement,
    edition: "1",
  },
  {
    name: "a function in an it.each row",
    source: 'it.each([{ check: (rows) => rows.map(idOf) }])("checks", run);',
    text: "rows.map",
    kind: CALL,
    edition: "1",
  },
  {
    name: "an options callback",
    source: "run({ onProgress: (event) => event.done && seen(event) });",
    text: "event.done &&",
    kind: SYNTAX_API.SyntaxKind.BinaryExpression,
    edition: "2",
  },
  {
    name: "a route map handler",
    source: 'serve({ "/tasks": (request) => request.ids.map(idOf) });',
    text: "request.ids.map",
    kind: CALL,
    edition: "1",
  },
  {
    name: "a fixture getter",
    source: "const fixture = { get rows() { return given ?? []; } };",
    text: "given ??",
    kind: SYNTAX_API.SyntaxKind.BinaryExpression,
    edition: "2",
  },
  {
    name: "a vi.fn implementation",
    source: "const clock = { now: vi.fn(() => given ?? 1) };",
    text: "given ??",
    kind: SYNTAX_API.SyntaxKind.BinaryExpression,
    edition: "2",
  },
  {
    name: "a bare vi.fn implementation",
    source: "const now = vi.fn(() => given ?? 1);",
    text: "given ??",
    kind: SYNTAX_API.SyntaxKind.BinaryExpression,
    edition: "2",
  },
  {
    name: "a mockImplementation",
    source: "now.mockImplementation(() => given ?? 1);",
    text: "given ??",
    kind: SYNTAX_API.SyntaxKind.BinaryExpression,
    edition: "2",
  },
];

const OUTSIDE_DOUBLE_SITES = [
  {
    name: "a test callback",
    source: 'it("reads", () => { rows.map(idOf); });',
    text: "rows.map",
    section: "a-method-that-computes-a-value",
  },
  {
    name: "a const arrow",
    source: "const idsOf = () => rows.map(idOf);",
    text: "rows.map",
    section: "a-method-that-computes-a-value",
  },
  {
    name: "an object literal value that is not a function",
    source: "const row = { ids: rows.map(idOf) };",
    text: "rows.map",
    section: "a-method-that-computes-a-value",
  },
  {
    name: "a callback inside a double's method",
    source: "const port = { all: () => run(() => rows.map(idOf)) };",
    text: "rows.map",
    section: "a-method-that-computes-a-value",
  },
];

describe("testBodyFormOf inside a function the test passes on", () => {
  it.each(DOUBLE_SITES)(
    "names the passed-on function fix, at the construct's own edition, for logic in $name",
    ({ source, text, kind, edition }) => {
      const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind });
      assert.isDefined(node);

      expect(formOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({
        introducedIn: edition,
        remedy: { section: "logic-inside-a-function-the-test-passes-on" },
      });
    },
  );

  it.each(OUTSIDE_DOUBLE_SITES)(
    "names the construct's own fix for logic in $name",
    ({ source, text, section }) => {
      const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
      assert.isDefined(node);

      expect(formOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({
        remedy: { section },
      });
    },
  );
});

const RELEASED_OWN_API_CALLS = [
  {
    name: "a port method given an object",
    source: 'paths.join({ segments: ["a", "b"] });',
    text: "paths.join",
  },
  {
    name: "a repository lookup given an object",
    source: 'repository.find({ id: "a" });',
    text: "repository.find",
  },
  {
    name: "a query given an object",
    source: 'store.filter({ status: "open" });',
    text: "store.filter",
  },
  {
    name: "a method given more arguments than any built-in of its name takes",
    source: 'screen.keys("x", true, true);',
    text: "screen.keys",
  },
  {
    name: "an entries method given an argument",
    source: "scenario.entries(output);",
    text: "scenario.entries",
  },
  {
    name: "a port imported from a relative module",
    source: 'import { paths } from "./paths.ts";\npaths.join({ segments: ["a"] });',
    text: "paths.join",
  },
  {
    name: "a port imported through a subpath import",
    source: 'import { paths } from "#src/paths.ts";\npaths.join({ segments: ["a"] });',
    text: "paths.join",
  },
  {
    name: "a port imported from a workspace package",
    source: 'import { paths } from "@app/paths";\npaths.join({ segments: ["a"] });',
    text: "paths.join",
  },
  {
    name: "a port loaded from a workspace package",
    source: 'const { paths } = await import("@app/paths");\npaths.join({ segments: ["a"] });',
    text: "paths.join",
  },
  {
    name: "a port built by a relative module's factory",
    source:
      'import { pathsOf } from "./paths.ts";\nconst paths = pathsOf();\npaths.join({ segments: ["a"] });',
    text: "paths.join",
  },
  {
    name: "a port held in an object literal beside a library",
    source:
      'import path from "node:path";\nconst deps = { path, paths: pathsOf() };\ndeps.paths.join({ segments: ["a"] });',
    text: "deps.paths.join",
  },
  {
    name: "a port destructured from a fixture",
    source: 'const { paths } = harness();\npaths.join({ segments: ["a"] });',
    text: "paths.join",
  },
];

const FLAGGED_LOOK_ALIKES = [
  {
    name: "includes given an object",
    source: 'rows.includes({ id: "a" });',
    text: "rows.includes",
  },
  { name: "indexOf given an object", source: 'rows.indexOf({ id: "a" });', text: "rows.indexOf" },
  { name: "push given an object", source: 'rows.push({ id: "a" });', text: "rows.push" },
  {
    name: "concat given objects",
    source: 'rows.concat({ id: "a" }, { id: "b" });',
    text: "rows.concat",
  },
  {
    name: "reduce given an object to start from",
    source: "rows.reduce(sum, { total: 0 });",
    text: "rows.reduce",
  },
  { name: "with given an object", source: 'rows.with(0, { id: "a" });', text: "rows.with" },
  {
    name: "splice given an object to insert",
    source: 'rows.splice(0, 1, { id: "a" });',
    text: "rows.splice",
  },
  { name: "fill given an object", source: 'rows.fill({ id: "a" });', text: "rows.fill" },
  {
    name: "a Buffer search with an encoding",
    source: 'buffer.includes("x", 0, "utf8");',
    text: "buffer.includes",
  },
  {
    name: "Object.entries given an object",
    source: "Object.entries({ a: 1 });",
    text: "Object.entries",
  },
  { name: "Object.keys given a value", source: "Object.keys(value);", text: "Object.keys" },
  {
    name: "join on node:path",
    source: 'import path from "node:path";\npath.join("a", "b", "c");',
    text: "path.join",
  },
  {
    name: "join on a namespace import of path",
    source: 'import * as path from "path";\npath.join("a", "b", "c");',
    text: "path.join",
  },
  {
    name: "join on a named import from node:path",
    source: 'import { posix } from "node:path";\nposix.join("a", "b", "c");',
    text: "posix.join",
  },
  {
    name: "join on a member of node:path",
    source: 'import path from "node:path";\npath.posix.join("a", "b", "c");',
    text: "path.posix.join",
  },
  {
    name: "a library helper given an object",
    source: 'import _ from "lodash";\n_.find(rows, { id: "a" }, 0, 1);',
    text: "_.find",
  },
  {
    name: "a string literal split by an object",
    source: '"a,b".split({ separator: "," });',
    text: '"a,b".split',
  },
  { name: "a port method given a variable", source: "paths.join(request);", text: "paths.join" },
  {
    name: "a call that spreads its arguments",
    source: "screen.keys(...presses);",
    text: "screen.keys",
  },
  {
    name: "a callback method given a callback",
    source: 'rows.find((row) => row.id === "a");',
    text: "rows.find",
  },
  {
    name: "join on node:path held in an object literal",
    source: 'import path from "node:path";\nconst deps = { path };\ndeps.path.join("a", "b", "c");',
    text: "deps.path.join",
  },
  {
    name: "join on node:path held under another name in an object literal",
    source:
      'import path from "node:path";\nconst deps = { files: path };\ndeps.files.join("a", "b", "c");',
    text: "deps.files.join",
  },
  { name: "find given an object as this", source: "rows.find(isA, {});", text: "rows.find" },
  { name: "map given an object as this", source: "rows.map(idOf, {});", text: "rows.map" },
  {
    name: "some given an object with properties as this",
    source: "rows.some(isOpen, { strict: true });",
    text: "rows.some",
  },
  {
    name: "find on a property of this given an object as this",
    source: "this.rows.find(isA, {});",
    text: "this.rows.find",
  },
  {
    name: "find on an awaited value given an object as this",
    source: "(await load()).find(isA, {});",
    text: "(await load()).find",
  },
  {
    name: "split given a splitter object",
    source: "text.split({ [Symbol.split]: splitter });",
    text: "text.split",
  },
  {
    name: "replace given a replacer object",
    source: 'text.replace({ [Symbol.replace]: replacer }, "b");',
    text: "text.replace",
  },
  {
    name: "join on a member destructured from node:path",
    source: 'import path from "node:path";\nconst { posix } = path;\nposix.join("a", "b", "c");',
    text: "posix.join",
  },
  {
    name: "entries on an alias of Object",
    source: "const o = Object;\no.entries({ a: 1 });",
    text: "o.entries",
  },
  {
    name: "a library method on a value the library built",
    source:
      'import { z } from "zod";\nconst schema = z.string();\nschema.startsWith("x", { message: "m" });',
    text: "schema.startsWith",
  },
];

describe("testBodyFormOf on a listed method name that is the adopter's own API", () => {
  it.each(RELEASED_OWN_API_CALLS)("names no form for $name", ({ source, text }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(formOf({ syntaxApi: SYNTAX_API, node })).toBeUndefined();
  });

  it.each(FLAGGED_LOOK_ALIKES)("still names a first-edition form for $name", ({ source, text }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(formOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({ introducedIn: "1" });
  });
});

const declaredTextsOf = (request: { readonly source: string }): readonly (readonly string[])[] =>
  [
    ...declarationsOf({
      syntaxApi: SYNTAX_API,
      sourceFile: firstStatementOf(request).getSourceFile(),
    }),
  ].map(([name, nodes]) => [name, ...nodes.map((node) => node.getText())]);

describe("declarationsOf", () => {
  it("names each declaration of each bound name in source order, destructured and nested ones included", () => {
    expect(
      declaredTextsOf({
        source:
          'const a = 1; const { b, c: [d] } = x; import e = require("e"); function f() { const a = 2; }',
      }),
    ).toEqual([
      ["a", "a = 1", "a = 2"],
      ["b", "{ b, c: [d] } = x"],
      ["d", "{ b, c: [d] } = x"],
      ["e", 'import e = require("e");'],
    ]);
  });
});
