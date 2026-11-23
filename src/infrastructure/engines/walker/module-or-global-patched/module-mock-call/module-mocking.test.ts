import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { Edition } from "../../../../../domain/rule-set/edition-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { PreparedWalkerCheck, SourceObservers } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./module-mocking.ts";

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

const FILE = repoPathOf("src/modules.test.ts");
const ADDRESS: CheckAddressText = "module-or-global-patched#module-mock-call";
const SYNTAX_API = defaultParsePort.syntaxApi;
const BINDING: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-26",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "module-mocking.ts" },
};

const sourceObservations = (request: {
  readonly source: string;
  readonly edition?: Edition;
}): {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
} => {
  const prepared = check.prepare({
    bindings: [{ ...BINDING, edition: request.edition ?? BINDING.edition }],
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

describe("Existing literal module-mock observations", () => {
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
      bindings: [BINDING],
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

  it("returns every literal module-mock call in order including zero arguments", () => {
    const observed = sourceObservations({
      source:
        "vi.mock('module');\nvi.mock();\nconst marker = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n",
    });
    const statements = observed.tree.getChildAt(0, observed.tree);
    observed.anchorAt
      .mockReturnValueOnce({ line: 1, column: 0 })
      .mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({
      node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree),
    });
    observed.observers.enter?.({
      node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree),
    });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet:
          "vi.mock('module'); vi.mock(); const marker = 'abcdefghijklmnopqrstuvwxyzabcdefgh…",
      },
      {
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet:
          "vi.mock(); const marker = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'…",
      },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 19 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains the literal receiver match even when vi is locally shadowed", () => {
    const observed = sourceObservations({ source: "const vi = local;\nvi.mock('module');\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);

    observed.observers.enter?.({
      node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree),
    });

    expect(observed.observers.finish()).toEqual([
      { check: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "vi.mock('module'); " },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 18 });
  });

  it("excludes aliases, computed members, other mocking methods and CD25 observations", () => {
    const observed = sourceObservations({
      source:
        "jest.mock('module');\nvitest.mock('module');\nvi['mock']('module');\nvi.doMock('module');\nvi.fn(() => 1);\nmock.mockImplementation(() => 1);\nvi.mock;\n",
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

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});

describe("Global patches in edition 2", () => {
  it.each([editionOf("2"), editionOf("3")])(
    "reports direct global stubs in edition %s",
    (edition) => {
      const observed = sourceObservations({
        source: "vi.stubGlobal('focus', value);",
        edition,
      });
      observed.observers.enter?.({
        node: observed.tree
          .getChildAt(0, observed.tree)
          .getChildAt(0, observed.tree)
          .getChildAt(0, observed.tree),
      });
      expect(observed.observers.finish()).toEqual([
        {
          check: ADDRESS,
          anchor: { line: 5, column: 2 },
          snippet: "vi.stubGlobal('focus', value);",
        },
      ]);
    },
  );

  it("reports assignments to process environment keys", () => {
    const observed = sourceObservations({
      source: "process.env['MODE'] = 'test';",
      edition: editionOf("2"),
    });
    observed.observers.enter?.({
      node: observed.tree
        .getChildAt(0, observed.tree)
        .getChildAt(0, observed.tree)
        .getChildAt(0, observed.tree),
    });
    expect(observed.observers.finish()).toEqual([
      { check: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "process.env['MODE'] = 'test';" },
    ]);
  });

  it("keeps global patches out of edition 1", () => {
    const observed = sourceObservations({ source: "vi.stubGlobal('focus', value);" });
    observed.observers.enter?.({
      node: observed.tree
        .getChildAt(0, observed.tree)
        .getChildAt(0, observed.tree)
        .getChildAt(0, observed.tree),
    });
    expect(observed.observers.finish()).toEqual([]);
  });

  it("does not follow a local environment alias", () => {
    const observed = sourceObservations({
      source: "environment.MODE = 'test';",
      edition: editionOf("2"),
    });
    observed.observers.enter?.({
      node: observed.tree
        .getChildAt(0, observed.tree)
        .getChildAt(0, observed.tree)
        .getChildAt(0, observed.tree),
    });
    expect(observed.observers.finish()).toEqual([]);
  });
});
