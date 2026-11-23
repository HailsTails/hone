import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { SourceObservers, WalkerRepository } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxNode, SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./cast-expressions.ts";

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });
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
const defaultParsePort = loadedParsePort.value;

const FILE = repoPathOf("src/casts.ts");
const ADDRESS: CheckAddressText = "claimed-type#unlisted-cast-site";
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-2",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "cast-expressions.ts" },
};
const THROUGH_UNKNOWN_MESSAGE = "cast through unknown — check the value's shape at runtime instead";

const statementCast = (request: {
  readonly tree: SyntaxTree;
  readonly index: number;
}): SyntaxNode =>
  request.tree
    .getChildAt(0, request.tree)
    .getChildAt(request.index, request.tree)
    .getChildAt(0, request.tree);

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
};

const sourceObservations = (request: { readonly source: string }): ObservationFixture => {
  const repository: WalkerRepository = {
    files: [FILE],
    exists: vi.fn().mockReturnValue("present"),
    disk: EMPTY_DISK,
  };
  const prepared = check.prepare({ bindings: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const file = prepared.value.prepareFile({
    file: FILE,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(file.outcome === "ok");
  assert(file.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(
    FILE,
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  const anchorAt = vi
    .fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 3, column: 2 });
  return { tree, observers: file.value.begin({ sourceFile: tree, anchorAt }), anchorAt };
};

describe("CD-2 existing cast capability", () => {
  it.each([
    {
      name: "all-depth excluded directory",
      fileName: "src/node_modules/example.ts",
      kind: "skipped",
    },
    { name: "root-only excluded directory", fileName: "vendor/example.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/example.tsx", kind: "syntax" },
    { name: "ES module TypeScript source", fileName: "src/example.mts", kind: "syntax" },
    { name: "CommonJS TypeScript source", fileName: "src/example.cts", kind: "syntax" },
    { name: "test source", fileName: "src/example.test.ts", kind: "syntax" },
    { name: "test helper source", fileName: "tests/test-support.ts", kind: "syntax" },
    { name: "proof script source", fileName: "scripts/install-proof-plan.ts", kind: "syntax" },
  ])("preserves source-family eligibility for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file, detail: "unexpected read" },
    });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a pragma-free file", source: "export const a = 1;\n", kind: "skipped" },
    {
      name: "a file under @ts-check",
      source: "// @ts-check\nexport const a = 1;\n",
      kind: "syntax",
    },
  ])(
    "judges a JavaScript source by whether the compiler checks it: $kind for $name",
    ({ source, kind }) => {
      const file = repoPathOf("src/example.js");
      const prepared = check.prepare({
        bindings: [CLAUSE],
        repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
        syntaxApi: SYNTAX_API,
      });
      assert(prepared.outcome === "ok");

      expect(
        prepared.value.prepareFile({
          file,
          readText: vi.fn().mockReturnValue({ outcome: "ok", value: source }),
        }),
      ).toMatchObject({ outcome: "ok", value: { kind } });
    },
  );

  it("reads a JavaScript source a tsconfig checks with checkJs", () => {
    const file = repoPathOf("src/example.mjs");
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: {
        files: [file],
        exists: vi.fn().mockReturnValue("present"),
        disk: textsDisk({
          root: "/repo",
          texts: { "tsconfig.json": '{"compilerOptions":{"checkJs":true}}' },
        }),
      },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");

    expect(
      prepared.value.prepareFile({
        file,
        readText: vi.fn().mockReturnValue({ outcome: "ok", value: "export const a = 1;\n" }),
      }),
    ).toMatchObject({ outcome: "ok", value: { kind: "syntax" } });
  });

  it("emits a JSDoc cast in a checked JavaScript file from the start of its JSDoc", () => {
    const file = repoPathOf("src/casts.js");
    const source = "// @ts-check\nuse(/** @type {Category} */ (rawText));\n";
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const selected = prepared.value.prepareFile({
      file,
      readText: vi.fn().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selected.outcome === "ok");
    assert(selected.value.kind === "syntax");
    const tree = SYNTAX_API.createSourceFile(file, source, SYNTAX_API.ScriptTarget.Latest, true);
    const anchorAt = vi
      .fn<(request: { readonly position: number }) => Anchor>()
      .mockReturnValue({ line: 2, column: 4 });
    const observers = selected.value.begin({ sourceFile: tree, anchorAt });

    observers.enter?.({
      node: statementCast({ tree, index: 0 }).getChildAt(2, tree).getChildAt(0, tree),
    });

    expect(observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 2, column: 4 },
        snippet: "/** @type {Category} */ (rawText)); ",
      },
    ]);
    expect(anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 17 });
  });

  it.each(["{any}", "{*}", "{?}", "{Array<any>}"])(
    "leaves a JSDoc cast to %s in a checked JavaScript file to cast-to-any",
    (type) => {
      const file = repoPathOf("src/casts.js");
      const source = `// @ts-check\nuse(/** @type ${type} */ (rawText));\n`;
      const prepared = check.prepare({
        bindings: [CLAUSE],
        repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
        syntaxApi: SYNTAX_API,
      });
      assert(prepared.outcome === "ok");
      const selected = prepared.value.prepareFile({
        file,
        readText: vi.fn().mockReturnValue({ outcome: "ok", value: source }),
      });
      assert(selected.outcome === "ok");
      assert(selected.value.kind === "syntax");
      const tree = SYNTAX_API.createSourceFile(file, source, SYNTAX_API.ScriptTarget.Latest, true);
      const observers = selected.value.begin({
        sourceFile: tree,
        anchorAt: vi.fn().mockReturnValue({ line: 2, column: 4 }),
      });

      observers.enter?.({
        node: statementCast({ tree, index: 0 }).getChildAt(2, tree).getChildAt(0, tree),
      });

      expect(observers.finish()).toEqual([]);
    },
  );

  it("emits an arbitrary cast with its owned clause, supplied anchor and eighty-character snippet", () => {
    const observed = sourceObservations({
      source:
        "rawText as Category;\nconst description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n",
    });
    const cast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet:
          "rawText as Category; const description = 'abcdefghijklmnopqrstuvwxyzabcdefghijkl…",
      },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("returns every violating observation in its supplied order", () => {
    const observed = sourceObservations({ source: "rawText as Category;\n<Category>other;\n" });
    const first = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);
    const second = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(1, observed.tree)
      .getChildAt(0, observed.tree);
    observed.anchorAt
      .mockReturnValueOnce({ line: 1, column: 0 })
      .mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({ node: first });
    observed.observers.enter?.({ node: second });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "rawText as Category; <Category>other; ",
      },
      { check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "<Category>other; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 21 }]]);
  });

  it("retains the existing angle-bracket type assertion predicate", () => {
    const observed = sourceObservations({ source: "<Category>rawText;\n" });
    const cast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { check: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "<Category>rawText; " },
    ]);
  });

  it("permits only const assertions, flagging unknown widenings, package names, indexed types and arrays alike", () => {
    const observed = sourceObservations({
      source:
        "candidate as unknown;\n'permitted' as const;\nschema as Schema;\njsonSchema as Tool['inputSchema'];\nallResult.value as ReadonlyArray<RowShape>;\nimport type { ZodObject as Schema } from 'zod/v4';\n",
    });

    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 0 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 1 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 2 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 3 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 4 }) });

    expect(observed.observers.finish()).toHaveLength(4);
    expect(observed.anchorAt.mock.calls).toEqual([
      [{ position: 0 }],
      [{ position: 44 }],
      [{ position: 62 }],
      [{ position: 97 }],
    ]);
  });

  it.each([
    { name: "an as const assertion", source: "MODES as const;\n" },
    { name: "an angle-bracket const assertion", source: "<const>MODES;\n" },
  ])("permits $name", ({ source }) => {
    const observed = sourceObservations({ source });

    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 0 }) });

    expect(observed.observers.finish()).toEqual([]);
  });

  it.each([
    {
      name: "an as widening",
      source: "candidate as unknown;\n",
      snippet: "candidate as unknown; ",
    },
    {
      name: "an angle-bracket widening",
      source: "<unknown>candidate;\n",
      snippet: "<unknown>candidate; ",
    },
  ])("flags $name to unknown", ({ source, snippet }) => {
    const observed = sourceObservations({ source });

    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 0 }) });

    expect(observed.observers.finish()).toEqual([
      { check: ADDRESS, anchor: { line: 3, column: 2 }, snippet },
    ]);
  });

  it("flags a double cast through unknown with its own message, and its unknown half", () => {
    const observed = sourceObservations({
      source: "rows as unknown as ReadonlyArray<RowShape>;\n",
    });
    const outer = statementCast({ tree: observed.tree, index: 0 });

    observed.observers.enter?.({ node: outer });
    observed.observers.enter?.({ node: outer.getChildAt(0, observed.tree) });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: `${THROUGH_UNKNOWN_MESSAGE}: rows as unknown as ReadonlyArray<RowShape>; `,
      },
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: "rows as unknown as ReadonlyArray<RowShape>; ",
      },
    ]);
  });

  it("leaves every cast whose type carries any to CD-1, including one nested in a multi-argument generic", () => {
    const observed = sourceObservations({
      source: "candidate as any;\ncandidate as Map<string, any>;\n",
    });
    const anyCast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);
    const genericCast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(1, observed.tree)
      .getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: anyCast });
    observed.observers.enter?.({ node: genericCast });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});
