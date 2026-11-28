import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { TestFiles } from "../../../../../domain/settings/test-files.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type {
  PieceHit,
  PreparedFileCheck,
  PreparedWalkerCheck,
  WalkerFile,
} from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./test-body-logic.ts";

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });
const FILE = repoPathOf("src/logic.test.ts");
const ADDRESS: CheckAddressText = "test-body-forms#all";
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  forms: {
    "branching-with-if": ADDRESS,
    "a-try-block": ADDRESS,
    "a-ternary": ADDRESS,
    "a-let": ADDRESS,
    "a-method-that-picks-or-tests-an-element": ADDRESS,
    "a-method-that-computes-a-value": ADDRESS,
    "a-method-that-mutates": ADDRESS,
    "a-short-circuit": ADDRESS,
    "an-optional-chain-after-an-index": ADDRESS,
    "an-optional-chain-on-a-mock-call": ADDRESS,
    "an-optional-chain-on-a-mock-result": ADDRESS,
    "an-optional-chain-on-a-property": ADDRESS,
    "an-optional-call": ADDRESS,
    "a-switch": ADDRESS,
    "serialising-or-parsing-json": ADDRESS,
    "merging-objects": ADDRESS,
    "building-an-object-from-entries": ADDRESS,
    "building-an-array-from-a-length": ADDRESS,
    "a-math-call": ADDRESS,
    "logic-inside-a-function-the-test-passes-on": ADDRESS,
  },
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-27",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "test-body-logic.ts" },
};

const SECOND_EDITION_CLAUSE: CheckBinding = { ...CLAUSE, edition: editionOf("2") };
const TEAM_ADDRESS: CheckAddressText = "branch-in-a-test#test-body";
const TEAM_SECOND_EDITION_CLAUSE: CheckBinding = {
  ...SECOND_EDITION_CLAUSE,
  address: TEAM_ADDRESS,
  forms: { "a-short-circuit": TEAM_ADDRESS },
};

const TEST_FILES: TestFiles = { suffixes: ["test", "spec"], folders: [] };

describe("the TypeScript line", () => {
  it("loads TypeScript 6 from the development install", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    expect(loaded.value.syntaxApi.version).toMatch(/^6\./);
  });
});

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
  ])(
    "preserves own test-family eligibility without reading for $name",
    async ({ fileName, kind }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const { syntaxApi } = loaded.value;
      const file = repoPathSchema.parse(fileName);
      const prepared = check.prepare({
        bindings: [CLAUSE],
        repository: {
          files: [file],
          exists: vi.fn().mockReturnValue("present"),
          disk: EMPTY_DISK,
          testFiles: { suffixes: ["test", "spec"], folders: [] },
        },
        syntaxApi,
      });
      assert(prepared.outcome === "ok");
      const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "file-unreadable", file, detail: "unexpected read" },
      });

      const selection = prepared.value.prepareFile({ file, readText });

      expect(selection).toMatchObject({
        outcome: "ok",
        value: { kind },
      });
      expect(readText).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: "an if statement",
      source: "if(x)f();\n",
      snippet: "if(x)f(); ",
      form: "branching-with-if",
    },
    {
      name: "a try block",
      source: "try{}catch(e){}\n",
      snippet: "try{}catch(e){} ",
      form: "a-try-block",
    },
  ])("emits $form for $name", async ({ source, snippet, form }) => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);

    enter({ node: tree.getChildAt(0, tree).getChildAt(0, tree) });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet,
        remedy: expect.objectContaining({ form }),
      },
    ]);
    expect(anchorAt.mock.calls).toEqual([[{ position: 0 }]]);
  });

  it.each([
    { name: "a ternary", source: "x?y:z;\n", snippet: "x?y:z; ", form: "a-ternary" },
    {
      name: "a module-level computing call",
      source: "r.map(f);\r\n",
      snippet: "r.map(f);\r ",
      form: "a-method-that-computes-a-value",
    },
    {
      name: "a module-level mutating call",
      source: "r.push(1);\r\n",
      snippet: "r.push(1);\r ",
      form: "a-method-that-mutates",
    },
  ])("emits $form for $name", async ({ source, snippet, form }) => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);

    enter({ node: tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree) });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet,
        remedy: expect.objectContaining({ form }),
      },
    ]);
    expect(anchorAt.mock.calls).toEqual([[{ position: 0 }]]);
  });

  it("emits observations in encounter order", async () => {
    const source = "if(x)f();\ntry{}catch(e){}\n";
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const statements = tree.getChildAt(0, tree);
    anchorAt
      .mockReturnValueOnce({ line: 1, column: 0 })
      .mockReturnValueOnce({ line: 2, column: 0 });

    enter({ node: statements.getChildAt(0, tree) });
    enter({ node: statements.getChildAt(1, tree) });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "if(x)f(); try{}catch(e){} ",
        remedy: expect.objectContaining({ form: "branching-with-if" }),
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: "try{}catch(e){} ",
        remedy: expect.objectContaining({ form: "a-try-block" }),
      },
    ]);
    expect(anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 10 }]]);
  });

  it("emits one finding for a multi-binding let statement and nothing at the end of the run", async () => {
    const source = "let a,b;\n";
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const letStatement = tree.getChildAt(0, tree).getChildAt(0, tree);
    assert(syntaxApi.isVariableStatement(letStatement));
    const firstBinding = letStatement.declarationList.declarations[0];
    const secondBinding = letStatement.declarationList.declarations[1];
    assert(firstBinding !== undefined);
    assert(secondBinding !== undefined);

    enter({ node: letStatement });
    enter({ node: letStatement.declarationList });
    enter({ node: firstBinding });
    enter({ node: secondBinding });
    const findings = observers.finish();
    const ended = prepared.value.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "let a,b; ",
        remedy: expect.objectContaining({ form: "a-let" }),
      },
    ]);
    expect(ended).toEqual({ outcome: "ok", value: [] });
  });

  it("retains a picking call inside a nested callback without a callback gate", async () => {
    const source = "it('',()=>s.filter(f));\r\n";
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const testCall = tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);
    assert(syntaxApi.isCallExpression(testCall));
    const callback = testCall.arguments[1];
    assert(callback !== undefined);
    assert(syntaxApi.isArrowFunction(callback));
    anchorAt.mockReturnValueOnce({ line: 1, column: 10 });

    enter({ node: testCall });
    enter({ node: callback });
    enter({ node: callback.body });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 10 },
        snippet: "s.filter(f));\r ",
        remedy: expect.objectContaining({ form: "a-method-that-picks-or-tests-an-element" }),
      },
    ]);
    expect(anchorAt.mock.calls).toEqual([[{ position: 10 }]]);
  });

  it("keeps exactly eighty source characters whole without collapsing whitespace", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source =
      "r.map(f);\nabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);

    enter({
      node: tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree),
    });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "r.map(f); abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr",
        remedy: expect.objectContaining({ form: "a-method-that-computes-a-value" }),
      },
    ]);
    expect(anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("preserves the declaration-list gaps without duplicating double-with-a-body, module-or-global-patched or throw-or-catch-in-a-test", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source = "const a=1;\nvar b=2;\nfor(let i=0;i<1;i++){}\n";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const statements = tree.getChildAt(0, tree);
    const forStatement = statements.getChildAt(2, tree);
    assert(syntaxApi.isForStatement(forStatement));
    assert(forStatement.initializer !== undefined);

    enter({ node: statements.getChildAt(0, tree) });
    enter({ node: statements.getChildAt(1, tree) });
    enter({ node: forStatement });
    enter({ node: forStatement.initializer });
    const findings = observers.finish();

    expect(findings).toEqual([]);
    expect(anchorAt).not.toHaveBeenCalled();
  });

  it("preserves the computed and alias gaps without duplicating double-with-a-body, module-or-global-patched or throw-or-catch-in-a-test", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source =
      "r['map'](f);\nmap(f);\nr.custom();\nvi.fn(()=>1);\nm.mockImplementation(()=>1);\nvi.mock('module');\nthrow failure;\n";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const statements = tree.getChildAt(0, tree);

    enter({ node: statements.getChildAt(0, tree).getChildAt(0, tree) });
    enter({ node: statements.getChildAt(1, tree).getChildAt(0, tree) });
    enter({ node: statements.getChildAt(2, tree).getChildAt(0, tree) });
    enter({ node: statements.getChildAt(3, tree).getChildAt(0, tree) });
    enter({ node: statements.getChildAt(4, tree).getChildAt(0, tree) });
    enter({ node: statements.getChildAt(5, tree).getChildAt(0, tree) });
    enter({ node: statements.getChildAt(6, tree) });
    const findings = observers.finish();

    expect(findings).toEqual([]);
    expect(anchorAt).not.toHaveBeenCalled();
  });

  it("preserves the conditional-type gap without duplicating double-with-a-body, module-or-global-patched or throw-or-catch-in-a-test", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source = "type Flag = X extends Y ? A : B;\n";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const statements = tree.getChildAt(0, tree);
    const typeDeclaration = statements.getChildAt(0, tree);
    assert(syntaxApi.isTypeAliasDeclaration(typeDeclaration));

    enter({ node: typeDeclaration.type });
    const findings = observers.finish();

    expect(findings).toEqual([]);
    expect(anchorAt).not.toHaveBeenCalled();
  });
});

const SECOND_EDITION_EXPRESSIONS = [
  { name: "nullish coalescing", source: "a ?? b;", form: "a-short-circuit" },
  { name: "logical or", source: "a || b;", form: "a-short-circuit" },
  { name: "logical and", source: "a && b;", form: "a-short-circuit" },
  { name: "nullish assignment", source: "a ??= b;", form: "a-short-circuit" },
  { name: "logical or assignment", source: "a ||= b;", form: "a-short-circuit" },
  { name: "logical and assignment", source: "a &&= b;", form: "a-short-circuit" },
  { name: "optional property access", source: "a?.b;", form: "an-optional-chain-on-a-property" },
  {
    name: "optional element access",
    source: "a?.[0];",
    form: "an-optional-chain-on-a-property",
  },
  { name: "optional call", source: "f?.(1);", form: "an-optional-call" },
  {
    name: "JSON.stringify",
    source: "JSON.stringify(value);",
    form: "serialising-or-parsing-json",
  },
  { name: "JSON.parse", source: "JSON.parse(text);", form: "serialising-or-parsing-json" },
  { name: "Object.assign", source: "Object.assign(target, source);", form: "merging-objects" },
  {
    name: "Object.fromEntries",
    source: "Object.fromEntries(pairs);",
    form: "building-an-object-from-entries",
  },
  { name: "Array.from", source: "Array.from(items);", form: "building-an-array-from-a-length" },
  { name: "a Math method", source: "Math.max(a, b);", form: "a-math-call" },
];

describe("CD-27 second-edition logic observations", () => {
  it.each(SECOND_EDITION_EXPRESSIONS)(
    "flags $name under the second edition with the $form fix",
    async ({ source, form }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const { syntaxApi } = loaded.value;
      const prepared = check.prepare({
        bindings: [SECOND_EDITION_CLAUSE],
        repository: {
          files: [FILE],
          exists: vi.fn().mockReturnValue("present"),
          disk: EMPTY_DISK,
          testFiles: TEST_FILES,
        },
        syntaxApi,
      });
      assert(prepared.outcome === "ok");
      const selection = prepared.value.prepareFile({
        file: FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
      });
      assert(selection.outcome === "ok");
      assert(selection.value.kind === "syntax");
      const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
      const anchorAt = vi
        .fn<(request: { readonly position: number }) => Anchor>()
        .mockReturnValue({ line: 1, column: 0 });
      const observers = selection.value.begin({ sourceFile: tree, anchorAt });
      const { enter } = observers;
      assert.isDefined(enter);
      const expression = tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);

      enter({ node: expression });
      const findings = observers.finish();

      expect(findings).toEqual([
        {
          check: ADDRESS,
          anchor: { line: 1, column: 0 },
          snippet: source,
          remedy: expect.objectContaining({ form }),
        },
      ]);
      expect(anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
    },
  );

  it.each(SECOND_EDITION_EXPRESSIONS)(
    "keeps $name unflagged under the first edition",
    async ({ source }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const { syntaxApi } = loaded.value;
      const prepared = check.prepare({
        bindings: [CLAUSE],
        repository: {
          files: [FILE],
          exists: vi.fn().mockReturnValue("present"),
          disk: EMPTY_DISK,
          testFiles: TEST_FILES,
        },
        syntaxApi,
      });
      assert(prepared.outcome === "ok");
      const selection = prepared.value.prepareFile({
        file: FILE,
        readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
      });
      assert(selection.outcome === "ok");
      assert(selection.value.kind === "syntax");
      const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
      const anchorAt = vi
        .fn<(request: { readonly position: number }) => Anchor>()
        .mockReturnValue({ line: 1, column: 0 });
      const observers = selection.value.begin({ sourceFile: tree, anchorAt });
      const { enter } = observers;
      assert.isDefined(enter);
      const expression = tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);

      enter({ node: expression });
      const findings = observers.finish();

      expect(findings).toEqual([]);
    },
  );

  it("flags a switch statement under the second edition", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [SECOND_EDITION_CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source = "switch (x) {}";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);

    enter({ node: tree.getChildAt(0, tree).getChildAt(0, tree) });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "switch (x) {}",
        remedy: expect.objectContaining({ form: "a-switch" }),
      },
    ]);
  });

  it("keeps a switch statement unflagged under the first edition", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source = "switch (x) {}";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);

    enter({ node: tree.getChildAt(0, tree).getChildAt(0, tree) });
    const findings = observers.finish();

    expect(findings).toEqual([]);
  });

  it("keeps flagging first-edition logic under the second edition", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [SECOND_EDITION_CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source = "r.map(f);";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const expression = tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);

    enter({ node: expression });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "r.map(f);",
        remedy: expect.objectContaining({ form: "a-method-that-computes-a-value" }),
      },
    ]);
  });

  it("attributes a second-edition hit only to the bindings running the second edition", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [CLAUSE, TEAM_SECOND_EDITION_CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const source = "a ?? b;";
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const expression = tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);

    enter({ node: expression });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: TEAM_ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "a ?? b;",
        remedy: expect.objectContaining({ form: "a-short-circuit" }),
      },
    ]);
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
  ])("keeps $name unflagged under the second edition", async ({ source }) => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const prepared = check.prepare({
      bindings: [SECOND_EDITION_CLAUSE],
      repository: {
        files: [FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: EMPTY_DISK,
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const expression = tree.getChildAt(0, tree).getChildAt(0, tree).getChildAt(0, tree);

    enter({ node: expression });
    const findings = observers.finish();

    expect(findings).toEqual([]);
  });
});

describe("own API imported through a package of the repository", () => {
  it("names no form for a port imported from a package the repository holds", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const source = 'import { paths } from "@app/paths";\npaths.join({ segments: ["a"] });';
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [repoPathOf("package.json"), repoPathOf("packages/paths/package.json"), FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({
          root: "/repo",
          texts: {
            "package.json": '{ "name": "app" }',
            "packages/paths/package.json": '{ "name": "@app/paths" }',
          },
        }),
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const call = tree.statements[1];
    assert.isDefined(call);
    assert(syntaxApi.isExpressionStatement(call));
    anchorAt.mockReturnValue({ line: 2, column: 0 });

    enter({ node: call.expression });
    const findings = observers.finish();

    expect(findings).toEqual([]);
  });

  it("names no form for a port imported through a subpath import", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const source = 'import { paths } from "#src/paths";\npaths.join({ segments: ["a"] });';
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [repoPathOf("package.json"), FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({ root: "/repo", texts: { "package.json": '{ "name": "app" }' } }),
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const call = tree.statements[1];
    assert.isDefined(call);
    assert(syntaxApi.isExpressionStatement(call));
    anchorAt.mockReturnValue({ line: 2, column: 0 });

    enter({ node: call.expression });
    const findings = observers.finish();

    expect(findings).toEqual([]);
  });

  it("still flags a port imported from a package the repository does not hold", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const source = 'import { paths } from "path-kit";\npaths.join({ segments: ["a"] });';
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [repoPathOf("package.json"), repoPathOf("packages/paths/package.json"), FILE],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({
          root: "/repo",
          texts: {
            "package.json": '{ "name": "app" }',
            "packages/paths/package.json": '{ "name": "@app/paths" }',
          },
        }),
        testFiles: TEST_FILES,
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");
    const selection = prepared.value.prepareFile({
      file: FILE,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selection.outcome === "ok");
    assert(selection.value.kind === "syntax");
    const tree = syntaxApi.createSourceFile(FILE, source, syntaxApi.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 1, column: 0 });
    const observers = selection.value.begin({ sourceFile: tree, anchorAt });
    const { enter } = observers;
    assert.isDefined(enter);
    const call = tree.statements[1];
    assert.isDefined(call);
    assert(syntaxApi.isExpressionStatement(call));
    anchorAt.mockReturnValue({ line: 2, column: 0 });

    enter({ node: call.expression });
    const findings = observers.finish();

    expect(findings).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: 'paths.join({ segments: ["a"] });',
        remedy: expect.objectContaining({ form: "a-method-that-computes-a-value" }),
      },
    ]);
  });
});

describe("the repository's declared test files", () => {
  it.each([
    { fileName: "src/order.spec.ts", kind: "syntax" },
    { fileName: "src/__tests__/order.ts", kind: "syntax" },
    { fileName: "src/order.test.ts", kind: "skipped" },
  ])("prepares $fileName as $kind under spec and __tests__", async ({ fileName, kind }) => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [file],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
      },
      syntaxApi,
    });
    assert(prepared.outcome === "ok");

    const selection = prepared.value.prepareFile({
      file,
      readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "" }),
    });

    expect(selection).toMatchObject({ outcome: "ok", value: { kind } });
  });
});
