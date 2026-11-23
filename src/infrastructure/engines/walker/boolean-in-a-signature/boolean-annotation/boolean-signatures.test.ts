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
  WalkerFile,
  WalkerRepository,
} from "../../runner/pieces/walker-piece.ts";
import type { SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./boolean-signatures.ts";

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

const FILE = repoPathOf("src/signatures.ts");
const ADDRESS: CheckAddressText = "boolean-in-a-signature#boolean-annotation";
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-43",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "boolean-signatures.ts" },
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
    exists: vi.fn<WalkerRepository["exists"]>().mockReturnValue("present"),
    disk: EMPTY_DISK,
  };
  const prepared = check.prepare({ bindings: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const readText = vi
    .fn<WalkerFile["readText"]>()
    .mockReturnValue({ outcome: "ok", value: request.source });
  const file = prepared.value.prepareFile({ file: FILE, readText });
  expect(file).toMatchObject({ outcome: "ok", value: { kind: "syntax" } });
  assert(file.outcome === "ok" && file.value.kind === "syntax");
  expect(readText).not.toHaveBeenCalled();
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

describe("CD43 existing authored boolean signatures", () => {
  it.each([
    { name: "TSX source", fileName: "src/view.tsx" },
    { name: "test source", fileName: "src/view.test.ts" },
    { name: "declaration source", fileName: "src/view.d.ts" },
    { name: "physical script", fileName: "scripts/task.ts" },
    { name: "nested root-only directory", fileName: "src/vendor/view.ts" },
  ])("admits $name without requesting text", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn<WalkerFile["readText"]>();

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({
      outcome: "ok",
      value: { kind: "syntax" },
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each([
    { name: "non-TypeScript union candidate", fileName: "src/view.test.js" },
    { name: "all-depth excluded directory", fileName: "src/node_modules/view.ts" },
    { name: "root-only excluded directory", fileName: "vendor/view.ts" },
  ])("excludes $name without requesting text", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      bindings: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn<WalkerFile["readText"]>();

    expect(prepared.value.prepareFile({ file, readText })).toEqual({
      outcome: "ok",
      value: { kind: "skipped" },
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it("emits the authored parent return before its parameter using supplied anchors and no repository repeat", () => {
    const observed = sourceObservations({ source: "function f(flag: boolean): boolean {}\n" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const parameter = declaration.parameters[0];
    assert(parameter !== undefined);
    observed.anchorAt
      .mockReturnValueOnce({ line: 1, column: 0 })
      .mockReturnValueOnce({ line: 1, column: 11 });

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: parameter });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "function f(flag: boolean): boolean {} ",
      },
      { check: ADDRESS, anchor: { line: 1, column: 11 }, snippet: "flag: boolean): boolean {} " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 11 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains a boolean with both nullish members on an authored property signature", () => {
    const observed = sourceObservations({
      source: "interface Input { enabled: boolean | null | undefined }",
    });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isInterfaceDeclaration(declaration));
    const property = declaration.members[0];
    assert(property !== undefined);

    observed.observers.enter?.({ node: property });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: "enabled: boolean | null | undefined }",
      },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 18 });
  });

  it("retains explicit method and call-signature returns with a nullish boolean member", () => {
    const observed = sourceObservations({
      source: "interface Factory { enabled(): boolean; (value): boolean | undefined; }",
    });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isInterfaceDeclaration(declaration));
    const method = declaration.members[0];
    const callable = declaration.members[1];
    assert(method !== undefined && callable !== undefined);

    observed.observers.enter?.({ node: method });
    observed.observers.enter?.({ node: callable });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: "enabled(): boolean; (value): boolean | undefined; }",
      },
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: "(value): boolean | undefined; }",
      },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: "true literal", source: "function f(value: true) {}" },
    { name: "false literal", source: "function f(value: false) {}" },
    { name: "boolean literal union", source: "function f(value: true | false) {}" },
    { name: "boolean with another member", source: "function f(value: boolean | string) {}" },
    { name: "unresolved alias", source: "function f(value: Flag) {}" },
  ])("preserves the $name gap", ({ source }) => {
    const observed = sourceObservations({ source });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const parameter = declaration.parameters[0];
    assert(parameter !== undefined);

    observed.observers.enter?.({ node: parameter });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("does not infer returns from JSDoc or runtime values", () => {
    const observed = sourceObservations({
      source: "/** @returns {boolean} */\nfunction f(value) { return true; }",
    });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));

    observed.observers.enter?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("retains the type-predicate return exception", () => {
    const observed = sourceObservations({
      source: "function isItem(value): value is Item { return true; }",
    });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));

    observed.observers.enter?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("preserves the exact eighty-character newline and ellipsis policy", () => {
    const observed = sourceObservations({
      source:
        "function f(): boolean {}\n0123456789012345678901234567890123456789012345678901234567890123456789",
    });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));

    observed.observers.enter?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([
      {
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet:
          "function f(): boolean {} 0123456789012345678901234567890123456789012345678901234…",
      },
    ]);
  });
});
