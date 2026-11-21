import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../protocol/runner-module/runner-module-schema.ts";
import type { Anchor } from "../../../../domain/finding/anchor.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { SyntaxNode, SyntaxTree } from "../runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../runner/toolchain/typescript-toolchain.ts";
import type { PreparedWalkerCheck, SourceObservers, WalkerFile } from "../runner/pieces/walker-piece.ts";
import { check } from "./test-body-logic.ts";
import { editionSchema, FIRST_EDITION } from "../../../content-files/edition.ts";
import { textsDisk } from "../runner/pieces/walker-disk.ts";

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });
const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../..`, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const defaultParsePort = loadedParsePort.value;

const FILE = repoPathSchema.parse("src/logic.test.ts");
const ADDRESS = clauseAddressSchema.parse("CD-27#test-body-logic");
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-27",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-body-logic.ts" },
};

const SECOND_EDITION_CLAUSE: RunnerClause = { ...CLAUSE, edition: editionSchema.parse("2") };
const TEAM_ADDRESS = clauseAddressSchema.parse("team/TM-27#test-body-logic");
const TEAM_SECOND_EDITION_CLAUSE: RunnerClause = { ...SECOND_EDITION_CLAUSE, address: TEAM_ADDRESS };

type SourceObservations = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly enter: NonNullable<SourceObservers["enter"]>;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
};

const sourceObservations = (request: { readonly source: string; readonly clauses: readonly RunnerClause[] }): SourceObservations => {
  const prepared = check.prepare({ clauses: request.clauses, repository: { files: [FILE], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({ file: FILE, readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: request.source }) });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 1, column: 0 });
  const observers = selected.value.begin({ sourceFile: tree, anchorAt });
  const { enter } = observers;
  assert.isDefined(enter);
  return { tree, observers, enter, anchorAt, finish: prepared.value.finish };
};

describe("CD-27 existing whole-test-file logic observations", () => {
  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/logic.test.ts", kind: "skipped" },
    { name: "root-only exclusion", fileName: "vendor/logic.test.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/logic.test.ts", kind: "syntax" },
    { name: "TSX test", fileName: "src/logic.test.tsx", kind: "syntax" },
    { name: "integration test", fileName: "src/logic.integration.test.ts", kind: "syntax" },
    { name: "physical script test", fileName: "scripts/logic.test.ts", kind: "syntax" },
    { name: "ordinary source", fileName: "src/logic.ts", kind: "skipped" },
    { name: "non-TypeScript test", fileName: "src/logic.test.js", kind: "skipped" },
  ])("preserves own test-family eligibility without reading for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("emits all structural observations in encounter order with one finding for a multi-binding let statement", () => {
    const observed = sourceObservations({ source: "if(x)f();\ntry{}catch(e){}\nx?y:z;\nlet a,b;\n", clauses: [CLAUSE] });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const letStatement = statements.getChildAt(3, observed.tree);
    assert(SYNTAX_API.isVariableStatement(letStatement));
    const firstBinding = letStatement.declarationList.declarations[0];
    const secondBinding = letStatement.declarationList.declarations[1];
    assert(firstBinding !== undefined);
    assert(secondBinding !== undefined);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 }).mockReturnValueOnce({ line: 3, column: 0 }).mockReturnValueOnce({ line: 4, column: 0 });

    observed.enter({ node: statements.getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(1, observed.tree) });
    observed.enter({ node: statements.getChildAt(2, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: letStatement });
    observed.enter({ node: letStatement.declarationList });
    observed.enter({ node: firstBinding });
    observed.enter({ node: secondBinding });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "if(x)f(); try{}catch(e){} x?y:z; let a,b; ", remedy: expect.objectContaining({ section: "branching-with-if" }) },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "try{}catch(e){} x?y:z; let a,b; ", remedy: expect.objectContaining({ section: "a-try-block" }) },
      { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: "x?y:z; let a,b; ", remedy: expect.objectContaining({ section: "a-ternary" }) },
      { clause: ADDRESS, anchor: { line: 4, column: 0 }, snippet: "let a,b; ", remedy: expect.objectContaining({ section: "a-let" }) },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 10 }], [{ position: 26 }], [{ position: 33 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains dynamic and mutation calls at module level and inside a nested callback without a callback gate", () => {
    const observed = sourceObservations({ source: "r.map(f);\r\nr.push(1);\r\nit('',()=>s.filter(f));\r\n", clauses: [CLAUSE] });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const testCall = statements.getChildAt(2, observed.tree).getChildAt(0, observed.tree);
    assert(SYNTAX_API.isCallExpression(testCall));
    const callback = testCall.arguments[1];
    assert(callback !== undefined);
    assert(SYNTAX_API.isArrowFunction(callback));
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 }).mockReturnValueOnce({ line: 3, column: 10 });

    observed.enter({ node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: testCall });
    observed.enter({ node: callback });
    observed.enter({ node: callback.body });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "r.map(f);\r r.push(1);\r it('',()=>s.filter(f));\r ", remedy: expect.objectContaining({ section: "a-method-that-computes-a-value" }) },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "r.push(1);\r it('',()=>s.filter(f));\r ", remedy: expect.objectContaining({ section: "a-method-that-mutates" }) },
      { clause: ADDRESS, anchor: { line: 3, column: 10 }, snippet: "s.filter(f));\r ", remedy: expect.objectContaining({ section: "a-method-that-picks-or-tests-an-element" }) },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 11 }], [{ position: 33 }]]);
  });

  it("adds the original ellipsis at exactly eighty source characters without collapsing whitespace", () => {
    const observed = sourceObservations({ source: "r.map(f);\nabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr", clauses: [CLAUSE] });

    observed.enter({ node: observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree) });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "r.map(f); abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr…", remedy: expect.objectContaining({ section: "a-method-that-computes-a-value" }) },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("preserves computed, alias, declaration-list and conditional-type gaps without duplicating CD25 CD26 or CD10", () => {
    const observed = sourceObservations({ source: "const a=1;\nvar b=2;\nfor(let i=0;i<1;i++){}\nr['map'](f);\nmap(f);\nr.custom();\nvi.fn(()=>1);\nm.mockImplementation(()=>1);\nvi.mock('module');\nthrow failure;\ntype Flag = X extends Y ? A : B;\n", clauses: [CLAUSE] });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const forStatement = statements.getChildAt(2, observed.tree);
    assert(SYNTAX_API.isForStatement(forStatement));
    assert(forStatement.initializer !== undefined);
    const typeDeclaration = statements.getChildAt(10, observed.tree);
    assert(SYNTAX_API.isTypeAliasDeclaration(typeDeclaration));

    observed.enter({ node: statements.getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(1, observed.tree) });
    observed.enter({ node: forStatement });
    observed.enter({ node: forStatement.initializer });
    observed.enter({ node: statements.getChildAt(3, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(4, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(5, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(6, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(7, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(8, observed.tree).getChildAt(0, observed.tree) });
    observed.enter({ node: statements.getChildAt(9, observed.tree) });
    observed.enter({ node: typeDeclaration.type });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});

const firstExpressionOf = (request: { readonly source: string; readonly clauses: readonly RunnerClause[] }): {
  readonly observed: SourceObservations;
  readonly expression: SyntaxNode;
} => {
  const observed = sourceObservations(request);
  return { observed, expression: observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree) };
};

const SECOND_EDITION_EXPRESSIONS = [
  { name: "nullish coalescing", source: "a ?? b;", section: "a-short-circuit" },
  { name: "logical or", source: "a || b;", section: "a-short-circuit" },
  { name: "logical and", source: "a && b;", section: "a-short-circuit" },
  { name: "nullish assignment", source: "a ??= b;", section: "a-short-circuit" },
  { name: "logical or assignment", source: "a ||= b;", section: "a-short-circuit" },
  { name: "logical and assignment", source: "a &&= b;", section: "a-short-circuit" },
  { name: "optional property access", source: "a?.b;", section: "an-optional-chain-on-a-property" },
  { name: "optional element access", source: "a?.[0];", section: "an-optional-chain-on-a-property" },
  { name: "optional call", source: "f?.(1);", section: "an-optional-call" },
  { name: "JSON.stringify", source: "JSON.stringify(value);", section: "serialising-or-parsing-json" },
  { name: "JSON.parse", source: "JSON.parse(text);", section: "serialising-or-parsing-json" },
  { name: "Object.assign", source: "Object.assign(target, source);", section: "merging-objects" },
  { name: "Object.fromEntries", source: "Object.fromEntries(pairs);", section: "building-an-object-from-entries" },
  { name: "Array.from", source: "Array.from(items);", section: "building-an-array-from-a-length" },
  { name: "a Math method", source: "Math.max(a, b);", section: "a-math-call" },
];

describe("CD-27 second-edition logic observations", () => {
  it.each(SECOND_EDITION_EXPRESSIONS)("flags $name under the second edition with the $section fix", ({ source, section }) => {
    const { observed, expression } = firstExpressionOf({ source, clauses: [SECOND_EDITION_CLAUSE] });

    observed.enter({ node: expression });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: source, remedy: expect.objectContaining({ section }) },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it.each(SECOND_EDITION_EXPRESSIONS)("keeps $name unflagged under the first edition", ({ source }) => {
    const { observed, expression } = firstExpressionOf({ source, clauses: [CLAUSE] });

    observed.enter({ node: expression });

    expect(observed.observers.finish()).toEqual([]);
  });

  it("flags a switch statement under the second edition only", () => {
    const second = sourceObservations({ source: "switch (x) {}", clauses: [SECOND_EDITION_CLAUSE] });
    const first = sourceObservations({ source: "switch (x) {}", clauses: [CLAUSE] });

    second.enter({ node: second.tree.getChildAt(0, second.tree).getChildAt(0, second.tree) });
    first.enter({ node: first.tree.getChildAt(0, first.tree).getChildAt(0, first.tree) });

    expect(second.observers.finish()).toEqual([{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "switch (x) {}", remedy: expect.objectContaining({ section: "a-switch" }) }]);
    expect(first.observers.finish()).toEqual([]);
  });

  it("keeps flagging first-edition logic under the second edition", () => {
    const { observed, expression } = firstExpressionOf({ source: "r.map(f);", clauses: [SECOND_EDITION_CLAUSE] });

    observed.enter({ node: expression });

    expect(observed.observers.finish()).toEqual([{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "r.map(f);", remedy: expect.objectContaining({ section: "a-method-that-computes-a-value" }) }]);
  });

  it("attributes a second-edition hit only to the clauses running the second edition", () => {
    const { observed, expression } = firstExpressionOf({ source: "a ?? b;", clauses: [CLAUSE, TEAM_SECOND_EDITION_CLAUSE] });

    observed.enter({ node: expression });

    expect(observed.observers.finish()).toEqual([{ clause: TEAM_ADDRESS, anchor: { line: 1, column: 0 }, snippet: "a ?? b;", remedy: expect.objectContaining({ section: "a-short-circuit" }) }]);
  });

  it.each([
    { name: "a literal index", source: "calls[0];" },
    { name: "a computed key", source: "files[path];" },
    { name: "a computed call by a banned name", source: "r['map'](f);" },
    { name: "a free call", source: "map(f);" },
    { name: "a namespace method off the denylist", source: "Promise.resolve(1);" },
    { name: "an unknown method on a denylisted namespace", source: "JSON.rawJSON(text);" },
    { name: "a mocking factory", source: "vi.fn();" },
    { name: "an asymmetric matcher", source: "expect.stringContaining('x');" },
    { name: "arithmetic", source: "a + b;" },
    { name: "a comparison", source: "a === b;" },
  ])("keeps $name unflagged under the second edition", ({ source }) => {
    const { observed, expression } = firstExpressionOf({ source, clauses: [SECOND_EDITION_CLAUSE] });

    observed.enter({ node: expression });

    expect(observed.observers.finish()).toEqual([]);
  });
});
