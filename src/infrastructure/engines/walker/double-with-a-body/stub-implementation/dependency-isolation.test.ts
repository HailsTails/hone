import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { PreparedWalkerCheck, SourceObservers } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./dependency-isolation.ts";

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

const FILE = repoPathOf("src/isolation.test.ts");
const ADDRESS: CheckAddressText = "double-with-a-body#stub-implementation";
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-25",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "dependency-isolation.ts" },
};

const sourceObservations = (request: {
  readonly source: string;
}): {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
} => {
  const prepared = check.prepare({
    bindings: [CLAUSE],
    repository: { files: [FILE], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({
    file: FILE,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(
    FILE,
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  const anchorAt = vi
    .fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 5, column: 2 });
  return {
    tree,
    observers: selected.value.begin({ sourceFile: tree, anchorAt }),
    anchorAt,
    finish: prepared.value.finish,
  };
};

describe("CD-25 existing dependency-isolation observations", () => {
  it.each([
    {
      name: "all-depth excluded directory",
      fileName: "src/node_modules/example.test.ts",
      kind: "skipped",
    },
    { name: "root-only excluded directory", fileName: "vendor/example.test.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.test.ts", kind: "syntax" },
    { name: "TSX test", fileName: "src/example.test.tsx", kind: "syntax" },
    { name: "integration test", fileName: "src/example.integration.test.ts", kind: "syntax" },
    { name: "physical scripts test", fileName: "scripts/example.test.ts", kind: "syntax" },
    { name: "ordinary source", fileName: "src/example.ts", kind: "skipped" },
    { name: "non-TypeScript test", fileName: "src/example.test.js", kind: "skipped" },
    { name: "declaration-like test name", fileName: "src/example.d.test.ts", kind: "syntax" },
  ])("preserves test-family eligibility without a read for $name", ({ fileName, kind }) => {
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

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({
      outcome: "ok",
      value: { kind },
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it("attributes every implementation observation only to CD25 in order with eighty-character snippets", () => {
    const observed = sourceObservations({
      source:
        "vi.fn(() => 1);\ncustom.mockImplementation(() => 2);\nconst marker = 'abcdefghijklmnopqrstuvwxyz';\n",
    });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const implementationCall = statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const replacementCall = statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt
      .mockReturnValueOnce({ line: 1, column: 0 })
      .mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({ node: implementationCall });
    observed.observers.enter?.({ node: replacementCall });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet:
          "vi.fn(() => 1); custom.mockImplementation(() => 2); const marker = 'abcdefghijkl…",
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet:
          "custom.mockImplementation(() => 2); const marker = 'abcdefghijklmnopqrstuvwxyz';…",
      },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 16 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("preserves non-function arguments and any receiver's zero-argument replacement quirk", () => {
    const observed = sourceObservations({ source: "vi.fn(7);\nforeign.mockImplementation();\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);

    observed.observers.enter?.({
      node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree),
    });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 5, column: 2 },
        snippet: "vi.fn(7); foreign.mockImplementation(); ",
      },
      { check: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "foreign.mockImplementation(); " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 10 }]]);
  });

  it("allows fixed-return fakes and preserves syntax gaps without reporting other disciplines", () => {
    const observed = sourceObservations({
      source:
        "vi.fn();\nvi.fn().mockReturnValue(1);\nvi.fn().mockResolvedValue(1);\nvi.fn().mockReturnValueOnce(1);\nmock.mockImplementationOnce(() => 1);\nvitest.fn(() => 1);\nvi['fn'](() => 1);\nvi.mock('module');\nrows.filter(predicate);\nthrow failure;\nvi.fn;\n",
    });
    const statements = observed.tree.getChildAt(0, observed.tree);

    observed.observers.enter?.({
      node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(2, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(3, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(4, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(5, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(6, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(7, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(8, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({ node: statements.getChildAt(9, observed.tree) });
    observed.observers.enter?.({
      node: statements.getChildAt(10, observed.tree).getChildAt(0, observed.tree),
    });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});
