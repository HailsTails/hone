import { assert, describe, expect, it } from "vitest";
import { defaultParsePort } from "../../../../../tests/typescript-parse-port.ts";
import type { SyntaxNode } from "../runner/toolchain/typescript-parse.ts";
import { syntaxNodeOf } from "../../../../../tests/syntax-node-of.ts";
import { TEST_BODY_REMEDIES, TEST_BODY_SECTIONS, testBodyFormOf } from "./test-body-logic.ts";

const SYNTAX_API = defaultParsePort.syntaxApi;

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
  { name: "find", source: "rows.find(isFirst);", edition: "1", section: "a-method-that-picks-or-tests-an-element" },
  { name: "at", source: "rows.at(0);", edition: "1", section: "a-method-that-picks-or-tests-an-element" },
  { name: "includes", source: "rows.includes(row);", edition: "1", section: "a-method-that-picks-or-tests-an-element" },
  { name: "map", source: "rows.map(idOf);", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "join", source: "parts.join(\",\");", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "push", source: "rows.push(row);", edition: "1", section: "a-method-that-mutates" },
  { name: "fill", source: "rows.fill(0);", edition: "1", section: "a-method-that-mutates" },
  { name: "a nullish fallback", source: "given ?? 1;", edition: "2", section: "a-short-circuit" },
  { name: "a logical and", source: "left && right;", edition: "2", section: "a-short-circuit" },
  { name: "a logical or assignment", source: "given ||= 1;", edition: "2", section: "a-short-circuit" },
  { name: "an optional property after an index", source: "tasks[0]?.id;", edition: "2", section: "an-optional-chain-after-an-index" },
  { name: "an optional element after an index", source: "rows[0]?.[1];", edition: "2", section: "an-optional-chain-after-an-index" },
  { name: "an optional chain on a mock call", source: "run.mock.calls[0]?.[0];", edition: "2", section: "an-optional-chain-on-a-mock-call" },
  { name: "an optional chain on a mock result", source: "run.mock.results[0]?.value;", edition: "2", section: "an-optional-chain-on-a-mock-result" },
  { name: "an optional chain on a mock's last call", source: "run.mock.lastCall?.[0];", edition: "2", section: "an-optional-chain-on-a-mock-call" },
  { name: "an optional chain on a mock instance", source: "Store.mock.instances[0]?.rows;", edition: "2", section: "an-optional-chain-after-an-index" },
  { name: "an optional chain on a mock context", source: "run.mock.contexts[0]?.name;", edition: "2", section: "an-optional-chain-after-an-index" },
  { name: "an optional property", source: "result.value?.name;", edition: "2", section: "an-optional-chain-on-a-property" },
  { name: "an optional call", source: "observers.enter?.();", edition: "2", section: "an-optional-call" },
  { name: "an optional call of a computing method", source: "rows.map?.(idOf);", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "Object.keys", source: "Object.keys(value);", edition: "1", section: "a-method-that-computes-a-value" },
  { name: "JSON.stringify", source: "JSON.stringify(value);", edition: "2", section: "serialising-or-parsing-json" },
  { name: "JSON.parse", source: "JSON.parse(text);", edition: "2", section: "serialising-or-parsing-json" },
  { name: "Object.assign", source: "Object.assign(target, source);", edition: "2", section: "merging-objects" },
  { name: "Object.fromEntries", source: "Object.fromEntries(pairs);", edition: "2", section: "building-an-object-from-entries" },
  { name: "Array.from", source: "Array.from({ length: 3 });", edition: "2", section: "building-an-array-from-a-length" },
  { name: "a Math method", source: "Math.max(a, b);", edition: "2", section: "a-math-call" },
];

const PLAIN_EXPRESSIONS = [
  { name: "element access", source: "rows[0];" },
  { name: "a free call", source: "build(rows);" },
  { name: "a computed method call", source: "rows[\"map\"](idOf);" },
  { name: "an assert.isDefined call", source: "assert.isDefined(first);" },
  { name: "a toMatchObject call", source: "expect(first).toMatchObject({ id: \"a\" });" },
  { name: "an unlisted JSON method", source: "JSON.rawJSON(text);" },
  { name: "an unlisted Object method", source: "Object.freeze(value);" },
];

describe("testBodyFormOf", () => {
  it.each(STATEMENT_FORMS)("names $name as introduced in edition $edition with the $section fix", ({ source, edition, section }) => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstStatementOf({ source }) })).toMatchObject({
      introducedIn: edition,
      remedy: { section },
    });
  });

  it.each(EXPRESSION_FORMS)("names $name as introduced in edition $edition with the $section fix", ({ source, edition, section }) => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source }) })).toMatchObject({
      introducedIn: edition,
      remedy: { section },
    });
  });

  it.each(PLAIN_EXPRESSIONS)("names no form for $name", ({ source }) => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source }) })).toBeUndefined();
  });

  it("names no form for a const statement", () => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstStatementOf({ source: "const total = 1;" }) })).toBeUndefined();
  });

  it("names the replacement for an optional chain after an index in its fix", () => {
    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node: firstExpressionOf({ source: "tasks[0]?.id;" }) })).toEqual({
      introducedIn: "2",
      remedy: {
        fix: "compare the whole element with toMatchObject, or destructure it and assert.isDefined it before reading it",
        page: "CHECKS.md",
        section: "an-optional-chain-after-an-index",
      },
    });
  });
});

describe("TEST_BODY_SECTIONS", () => {
  it("lists each CHECKS.md section a finding can name, once, in page order", () => {
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
  it("gives each section's fix, word for word, on CHECKS.md, in page order", () => {
    expect(TEST_BODY_REMEDIES).toEqual([
      {
        fix: "write one test per case, or one it.each table; to narrow a value that may be missing, assert.isDefined it",
        page: "CHECKS.md",
        section: "branching-with-if",
      },
      {
        fix: "assert the throw with expect(() => act()).toThrow or await expect(act()).rejects, or assert the failure the unit returns",
        page: "CHECKS.md",
        section: "a-try-block",
      },
      { fix: "write the value out, or give each case its own it.each row", page: "CHECKS.md", section: "a-ternary" },
      { fix: "use const; record calls with vi.fn and assert them with toHaveBeenCalledWith", page: "CHECKS.md", section: "a-let" },
      {
        fix: "assert on the whole array with toEqual, toContain, toContainEqual or expect.arrayContaining",
        page: "CHECKS.md",
        section: "a-method-that-picks-or-tests-an-element",
      },
      {
        fix: "write the expected value out, or match part of it with toMatchObject, toHaveLength or expect.stringContaining",
        page: "CHECKS.md",
        section: "a-method-that-computes-a-value",
      },
      { fix: "write the finished array out as a literal", page: "CHECKS.md", section: "a-method-that-mutates" },
      { fix: "write the value it gives; to narrow a value that may be missing, assert.isDefined it", page: "CHECKS.md", section: "a-short-circuit" },
      {
        fix: "compare the whole element with toMatchObject, or destructure it and assert.isDefined it before reading it",
        page: "CHECKS.md",
        section: "an-optional-chain-after-an-index",
      },
      {
        fix: "assert the call with toHaveBeenNthCalledWith or toHaveBeenLastCalledWith",
        page: "CHECKS.md",
        section: "an-optional-chain-on-a-mock-call",
      },
      {
        fix: "assert what it returned with toHaveNthReturnedWith or toHaveLastReturnedWith",
        page: "CHECKS.md",
        section: "an-optional-chain-on-a-mock-result",
      },
      {
        fix: "compare the whole value with toMatchObject, or destructure it and assert.isDefined it before reading it",
        page: "CHECKS.md",
        section: "an-optional-chain-on-a-property",
      },
      { fix: "assert.isDefined the function, then call it", page: "CHECKS.md", section: "an-optional-call" },
      { fix: "write one test per case, or one it.each table", page: "CHECKS.md", section: "a-switch" },
      {
        fix: "assert the object the unit gives back, written out; a unit that gives back only text should hand over an object, leaving the text to the adapter at its edge",
        page: "CHECKS.md",
        section: "serialising-or-parsing-json",
      },
      { fix: "write the object out, spreading what it copies; to give an Error a property, assign it", page: "CHECKS.md", section: "merging-objects" },
      { fix: "write the object out as a literal", page: "CHECKS.md", section: "building-an-object-from-entries" },
      { fix: "write a short array out as a literal; the page shows no form for a long one", page: "CHECKS.md", section: "building-an-array-from-a-length" },
      { fix: "write the number out", page: "CHECKS.md", section: "a-math-call" },
      {
        fix: "make it a vi.fn spy with a written-out mockReturnValue, and assert what it was asked with toHaveBeenCalledExactlyOnceWith; the recipe is Stub with vi.fn",
        page: "CHECKS.md",
        section: "logic-inside-a-function-the-test-passes-on",
      },
    ]);
  });
});

const CALL = SYNTAX_API.SyntaxKind.CallExpression;

const DOUBLE_SITES = [
  { name: "an arrow property", source: "const port = { isFile: (path) => files.includes(path) };", text: "files.includes", kind: CALL, edition: "1" },
  { name: "a method", source: "const port = { isFile(path) { return files.includes(path); } };", text: "files.includes", kind: CALL, edition: "1" },
  { name: "a function expression property", source: "const port = { read: function () { return given ?? \"\"; } };", text: "given ??", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
  { name: "a double passed inline", source: "run({ fileKind: { isFile: (path) => path.endsWith(\".ts\") } });", text: "path.endsWith", kind: CALL, edition: "1" },
  { name: "a branch inside a method", source: "const port = { read(path) { if (path) {} } };", text: "if (path)", kind: SYNTAX_API.SyntaxKind.IfStatement, edition: "1" },
  { name: "a function in an it.each row", source: "it.each([{ check: (rows) => rows.map(idOf) }])(\"checks\", run);", text: "rows.map", kind: CALL, edition: "1" },
  { name: "an options callback", source: "run({ onProgress: (event) => event.done && seen(event) });", text: "event.done &&", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
  { name: "a route map handler", source: "serve({ \"/tasks\": (request) => request.ids.map(idOf) });", text: "request.ids.map", kind: CALL, edition: "1" },
  { name: "a fixture getter", source: "const fixture = { get rows() { return given ?? []; } };", text: "given ??", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
  { name: "a vi.fn implementation", source: "const clock = { now: vi.fn(() => given ?? 1) };", text: "given ??", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
  { name: "a bare vi.fn implementation", source: "const now = vi.fn(() => given ?? 1);", text: "given ??", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
  { name: "a mockImplementation", source: "now.mockImplementation(() => given ?? 1);", text: "given ??", kind: SYNTAX_API.SyntaxKind.BinaryExpression, edition: "2" },
];

const OUTSIDE_DOUBLE_SITES = [
  { name: "a test callback", source: "it(\"reads\", () => { rows.map(idOf); });", text: "rows.map", section: "a-method-that-computes-a-value" },
  { name: "a const arrow", source: "const idsOf = () => rows.map(idOf);", text: "rows.map", section: "a-method-that-computes-a-value" },
  { name: "an object literal value that is not a function", source: "const row = { ids: rows.map(idOf) };", text: "rows.map", section: "a-method-that-computes-a-value" },
  { name: "a callback inside a double's method", source: "const port = { all: () => run(() => rows.map(idOf)) };", text: "rows.map", section: "a-method-that-computes-a-value" },
];

describe("testBodyFormOf inside a function the test passes on", () => {
  it.each(DOUBLE_SITES)("names the passed-on function fix, at the construct's own edition, for logic in $name", ({ source, text, kind, edition }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({
      introducedIn: edition,
      remedy: { section: "logic-inside-a-function-the-test-passes-on" },
    });
  });

  it.each(OUTSIDE_DOUBLE_SITES)("names the construct's own fix for logic in $name", ({ source, text, section }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({
      remedy: { section },
    });
  });
});

const RELEASED_OWN_API_CALLS = [
  { name: "a port method given an object", source: "paths.join({ segments: [\"a\", \"b\"] });", text: "paths.join" },
  { name: "a repository lookup given an object", source: "repository.find({ id: \"a\" });", text: "repository.find" },
  { name: "a query given an object", source: "store.filter({ status: \"open\" });", text: "store.filter" },
  { name: "a method given more arguments than any built-in of its name takes", source: "screen.keys(\"x\", true, true);", text: "screen.keys" },
  { name: "an entries method given an argument", source: "scenario.entries(output);", text: "scenario.entries" },
  { name: "a port imported from a relative module", source: "import { paths } from \"./paths.ts\";\npaths.join({ segments: [\"a\"] });", text: "paths.join" },
  { name: "a port built by a relative module's factory", source: "import { pathsOf } from \"./paths.ts\";\nconst paths = pathsOf();\npaths.join({ segments: [\"a\"] });", text: "paths.join" },
  { name: "a port held in an object literal beside a library", source: "import path from \"node:path\";\nconst deps = { path, paths: pathsOf() };\ndeps.paths.join({ segments: [\"a\"] });", text: "deps.paths.join" },
  { name: "a port destructured from a fixture", source: "const { paths } = harness();\npaths.join({ segments: [\"a\"] });", text: "paths.join" },
];

const FLAGGED_LOOK_ALIKES = [
  { name: "includes given an object", source: "rows.includes({ id: \"a\" });", text: "rows.includes" },
  { name: "indexOf given an object", source: "rows.indexOf({ id: \"a\" });", text: "rows.indexOf" },
  { name: "push given an object", source: "rows.push({ id: \"a\" });", text: "rows.push" },
  { name: "concat given objects", source: "rows.concat({ id: \"a\" }, { id: \"b\" });", text: "rows.concat" },
  { name: "reduce given an object to start from", source: "rows.reduce(sum, { total: 0 });", text: "rows.reduce" },
  { name: "with given an object", source: "rows.with(0, { id: \"a\" });", text: "rows.with" },
  { name: "splice given an object to insert", source: "rows.splice(0, 1, { id: \"a\" });", text: "rows.splice" },
  { name: "fill given an object", source: "rows.fill({ id: \"a\" });", text: "rows.fill" },
  { name: "a Buffer search with an encoding", source: "buffer.includes(\"x\", 0, \"utf8\");", text: "buffer.includes" },
  { name: "Object.entries given an object", source: "Object.entries({ a: 1 });", text: "Object.entries" },
  { name: "Object.keys given a value", source: "Object.keys(value);", text: "Object.keys" },
  { name: "join on node:path", source: "import path from \"node:path\";\npath.join(\"a\", \"b\", \"c\");", text: "path.join" },
  { name: "join on a namespace import of path", source: "import * as path from \"path\";\npath.join(\"a\", \"b\", \"c\");", text: "path.join" },
  { name: "join on a named import from node:path", source: "import { posix } from \"node:path\";\nposix.join(\"a\", \"b\", \"c\");", text: "posix.join" },
  { name: "join on a member of node:path", source: "import path from \"node:path\";\npath.posix.join(\"a\", \"b\", \"c\");", text: "path.posix.join" },
  { name: "a library helper given an object", source: "import _ from \"lodash\";\n_.find(rows, { id: \"a\" }, 0, 1);", text: "_.find" },
  { name: "a string literal split by an object", source: "\"a,b\".split({ separator: \",\" });", text: "\"a,b\".split" },
  { name: "a port method given a variable", source: "paths.join(request);", text: "paths.join" },
  { name: "a call that spreads its arguments", source: "screen.keys(...presses);", text: "screen.keys" },
  { name: "a callback method given a callback", source: "rows.find((row) => row.id === \"a\");", text: "rows.find" },
  { name: "join on node:path held in an object literal", source: "import path from \"node:path\";\nconst deps = { path };\ndeps.path.join(\"a\", \"b\", \"c\");", text: "deps.path.join" },
  { name: "join on node:path held under another name in an object literal", source: "import path from \"node:path\";\nconst deps = { files: path };\ndeps.files.join(\"a\", \"b\", \"c\");", text: "deps.files.join" },
  { name: "find given an object as this", source: "rows.find(isA, {});", text: "rows.find" },
  { name: "map given an object as this", source: "rows.map(idOf, {});", text: "rows.map" },
  { name: "some given an object with properties as this", source: "rows.some(isOpen, { strict: true });", text: "rows.some" },
  { name: "find on a property of this given an object as this", source: "this.rows.find(isA, {});", text: "this.rows.find" },
  { name: "find on an awaited value given an object as this", source: "(await load()).find(isA, {});", text: "(await load()).find" },
  { name: "split given a splitter object", source: "text.split({ [Symbol.split]: splitter });", text: "text.split" },
  { name: "replace given a replacer object", source: "text.replace({ [Symbol.replace]: replacer }, \"b\");", text: "text.replace" },
  { name: "join on a member destructured from node:path", source: "import path from \"node:path\";\nconst { posix } = path;\nposix.join(\"a\", \"b\", \"c\");", text: "posix.join" },
  { name: "entries on an alias of Object", source: "const o = Object;\no.entries({ a: 1 });", text: "o.entries" },
  { name: "a library method on a value the library built", source: "import { z } from \"zod\";\nconst schema = z.string();\nschema.startsWith(\"x\", { message: \"m\" });", text: "schema.startsWith" },
];

describe("testBodyFormOf on a listed method name that is the adopter's own API", () => {
  it.each(RELEASED_OWN_API_CALLS)("names no form for $name", ({ source, text }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toBeUndefined();
  });

  it.each(FLAGGED_LOOK_ALIKES)("still names a first-edition form for $name", ({ source, text }) => {
    const node = syntaxNodeOf({ syntaxApi: SYNTAX_API, source, text, kind: CALL });
    assert.isDefined(node);

    expect(testBodyFormOf({ syntaxApi: SYNTAX_API, node })).toMatchObject({ introducedIn: "1" });
  });
});
