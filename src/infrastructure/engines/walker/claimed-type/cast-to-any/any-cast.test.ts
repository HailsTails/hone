import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type {
  PreparedWalkerCheck,
  SourceObservers,
  WalkerRepository,
} from "../../runner/pieces/walker-piece.ts";
import type { SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./any-cast.ts";

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

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });

const FILE = repoPathOf("src/casts.ts");
const ADDRESS: CheckAddressText = "claimed-type#cast-to-any";
const SYNTAX_API = loadedParsePort.value.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-1",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "any-cast.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
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
  return {
    tree,
    observers: file.value.begin({ sourceFile: tree, anchorAt }),
    anchorAt,
    finish: prepared.value.finish,
  };
};

describe("CD-1 existing any-cast capability", () => {
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

  it.each([
    { type: "{any}", snippet: "/** @type {any} */ (rawText)); " },
    { type: "{*}", snippet: "/** @type {*} */ (rawText)); " },
    { type: "{?}", snippet: "/** @type {?} */ (rawText)); " },
    { type: "{Array<any>}", snippet: "/** @type {Array<any>} */ (rawText)); " },
  ])(
    "emits a JSDoc cast to $type in a checked JavaScript file from the start of its JSDoc",
    ({ type, snippet }) => {
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
      const anchorAt = vi
        .fn<(request: { readonly position: number }) => Anchor>()
        .mockReturnValue({ line: 2, column: 4 });
      const observers = selected.value.begin({ sourceFile: tree, anchorAt });

      observers.enter?.({
        node: tree
          .getChildAt(0, tree)
          .getChildAt(0, tree)
          .getChildAt(0, tree)
          .getChildAt(2, tree)
          .getChildAt(0, tree),
      });

      expect(observers.finish()).toEqual([
        { check: ADDRESS, anchor: { line: 2, column: 4 }, snippet },
      ]);
      expect(anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 17 });
    },
  );

  it("leaves an any-free JSDoc cast in a checked JavaScript file to unlisted-cast-site", () => {
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
    const observers = selected.value.begin({
      sourceFile: tree,
      anchorAt: vi.fn().mockReturnValue({ line: 2, column: 4 }),
    });

    observers.enter?.({
      node: tree
        .getChildAt(0, tree)
        .getChildAt(0, tree)
        .getChildAt(0, tree)
        .getChildAt(2, tree)
        .getChildAt(0, tree),
    });

    expect(observers.finish()).toEqual([]);
  });

  it("emits an any-cast using the supplied anchor and the existing eighty-character snippet", () => {
    const observed = sourceObservations({
      source:
        "candidate as any;\nconst description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n",
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
          "candidate as any; const description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmno…",
      },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("returns every violating observation in order including an angle-bracket any assertion", () => {
    const observed = sourceObservations({ source: "candidate as any;\n<any>other;\n" });
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
      { check: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "candidate as any; <any>other; " },
      { check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "<any>other; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 18 }]]);
  });

  it("leaves an any-free unknown widening to CD-2 and flags an any nested in a multi-argument generic", () => {
    const observed = sourceObservations({
      source: "candidate as unknown;\ncandidate as Map<string, any>;\n",
    });
    const unknownCast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);
    const genericCast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(1, observed.tree)
      .getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: unknownCast });
    observed.observers.enter?.({ node: genericCast });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: "candidate as Map<string, any>; ",
      },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 22 });
  });

  it("does not expand the cast-derived capability to a bare any keyword", () => {
    const observed = sourceObservations({ source: "let value: any;\n" });
    const keyword = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(1, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(2, observed.tree);

    observed.observers.enter?.({ node: keyword });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("does not attribute a later any annotation to an earlier any-free cast", () => {
    const observed = sourceObservations({
      source: "candidate as Profile;\nconst value: any = candidate;\nMODES as const;\n",
    });
    const profileCast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);
    const constCast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(2, observed.tree)
      .getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: profileCast });
    observed.observers.enter?.({ node: constCast });

    expect(observed.observers.finish()).toEqual([]);
  });

  it.each([
    {
      name: "an array of any over a property value",
      source: "rows.value as Array<any>;\n",
      snippet: "rows.value as Array<any>; ",
    },
    {
      name: "a record of any",
      source: "raw as Record<string, any>;\n",
      snippet: "raw as Record<string, any>; ",
    },
    {
      name: "a package type over any",
      source: "schema as ZodType<any>;\n",
      snippet: "schema as ZodType<any>; ",
    },
    {
      name: "an any nested in an object type",
      source: "raw as { readonly rows: ReadonlyArray<any> };\n",
      snippet: "raw as { readonly rows: ReadonlyArray<any> }; ",
    },
  ])("flags $name, whatever CD-2 permits", ({ source, snippet }) => {
    const observed = sourceObservations({ source });
    const cast = observed.tree
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { check: ADDRESS, anchor: { line: 3, column: 2 }, snippet },
    ]);
  });
});
