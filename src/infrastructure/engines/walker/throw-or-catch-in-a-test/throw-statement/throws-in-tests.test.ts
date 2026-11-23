import { assert, describe, expect, it, type Mock, vi } from "vitest";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { SourceObservers, WalkerRepository } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./throws-in-tests.ts";

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

const ADDRESS: CheckAddressText = "throw-or-catch-in-a-test#throw-statement";
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-10",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "throws-in-tests.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
};

const sourceObservations = (request: {
  readonly file: string;
  readonly source: string;
}): ObservationFixture => {
  const file = repoPathSchema.parse(request.file);
  const repository: WalkerRepository = {
    files: [file],
    exists: vi.fn().mockReturnValue("present"),
    disk: EMPTY_DISK,
  };
  const prepared = check.prepare({ bindings: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({
    file,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(
    file,
    request.source,
    SYNTAX_API.ScriptTarget.Latest,
    true,
  );
  const anchorAt = vi
    .fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 5, column: 2 });
  return { tree, observers: selected.value.begin({ sourceFile: tree, anchorAt }), anchorAt };
};

describe("CD-10 existing test throw observation", () => {
  it("reports every top-level throw in an eligible TSX test in observation order", () => {
    const observed = sourceObservations({
      file: "src/example.test.tsx",
      source: "throw first;\nthrow second;\n",
    });
    const first = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const second = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree);
    observed.anchorAt
      .mockReturnValueOnce({ line: 5, column: 2 })
      .mockReturnValueOnce({ line: 6, column: 0 });

    observed.observers.enter?.({ node: first });
    observed.observers.enter?.({ node: second });

    expect(observed.observers.finish()).toEqual([
      { check: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "throw first; throw second; " },
      { check: ADDRESS, anchor: { line: 6, column: 0 }, snippet: "throw second; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 13 }]]);
  });

  it("allows the corrected assertion call without adding a throw finding", () => {
    const observed = sourceObservations({
      file: "src/example.test.ts",
      source: "assert.fail('failure');\n",
    });
    const statement = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: statement });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it.each([
    "src/example.ts",
    "src/example.spec.ts",
    "src/example.test.js",
    "src/node_modules/example.test.ts",
    "vendor/example.test.ts",
  ])("preserves the existing test-family exclusion for %s", (fileName) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "ok", value: "throw failure;\n" });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toEqual({ outcome: "ok", value: { kind: "skipped" } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("retains an eligible test under a nested root-only directory without reading during preparation", () => {
    const file = repoPathOf("src/vendor/example.test.ts");
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

    expect(selected).toMatchObject({
      outcome: "ok",
      value: { kind: "syntax", begin: expect.any(Function) },
    });
    expect(readText).not.toHaveBeenCalled();
  });
});
