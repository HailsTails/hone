import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../protocol/runner-module/runner-module-schema.ts";
import type { Anchor } from "../../../../domain/finding/anchor.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { SyntaxNode, SyntaxTree } from "../runner/toolchain/typescript-parse.ts";
import { defaultParsePort } from "../../../../../tests/typescript-parse-port.ts";
import type { SourceObservers, WalkerRepository } from "../runner/pieces/walker-piece.ts";
import { check } from "./cast-expressions.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";
import { EMPTY_DISK } from "../../../../../tests/empty-walker-disk.ts";

const FILE = repoPathSchema.parse("src/casts.ts");
const ADDRESS = clauseAddressSchema.parse("CD-2#cast-expressions");
const SYNTAX_API = defaultParsePort.syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-2",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "cast-expressions.ts" },
};
const THROUGH_UNKNOWN_MESSAGE = "cast through unknown — check the value's shape at runtime instead";

const statementCast = (request: { readonly tree: SyntaxTree; readonly index: number }): SyntaxNode =>
  request.tree.getChildAt(0, request.tree).getChildAt(request.index, request.tree).getChildAt(0, request.tree);

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
};

const sourceObservations = (request: { readonly source: string }): ObservationFixture => {
  const repository: WalkerRepository = { files: [FILE], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK };
  const prepared = check.prepare({ clauses: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const file = prepared.value.prepareFile({
    file: FILE,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(file.outcome === "ok");
  assert(file.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 3, column: 2 });
  return { tree, observers: file.value.begin({ sourceFile: tree, anchorAt }), anchorAt };
};

describe("CD-2 existing cast capability", () => {
  it.each([
    { name: "all-depth excluded directory", fileName: "src/node_modules/example.ts", kind: "skipped" },
    { name: "root-only excluded directory", fileName: "vendor/example.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/example.tsx", kind: "syntax" },
    { name: "test source", fileName: "src/example.test.ts", kind: "syntax" },
    { name: "test helper source", fileName: "tests/test-support.ts", kind: "syntax" },
    { name: "proof script source", fileName: "scripts/install-proof-plan.ts", kind: "syntax" },
    { name: "non-TypeScript union candidate", fileName: "src/example.test.js", kind: "skipped" },
  ])("preserves source-family eligibility for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("emits an arbitrary cast with its owned clause, supplied anchor and eighty-character snippet", () => {
    const observed = sourceObservations({ source: "rawText as Category;\nconst description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "rawText as Category; const description = 'abcdefghijklmnopqrstuvwxyzabcdefghijkl…" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("returns every violating observation in its supplied order", () => {
    const observed = sourceObservations({ source: "rawText as Category;\n<Category>other;\n" });
    const first = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const second = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({ node: first });
    observed.observers.enter?.({ node: second });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "rawText as Category; <Category>other; " },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "<Category>other; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 21 }]]);
  });

  it("retains the existing angle-bracket type assertion predicate", () => {
    const observed = sourceObservations({ source: "<Category>rawText;\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "<Category>rawText; " },
    ]);
  });

  it("permits only const assertions, flagging unknown widenings, package names, indexed types and arrays alike", () => {
    const observed = sourceObservations({ source: "candidate as unknown;\n'permitted' as const;\nschema as Schema;\njsonSchema as Tool['inputSchema'];\nallResult.value as ReadonlyArray<RowShape>;\nimport type { ZodObject as Schema } from 'zod/v4';\n" });

    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 0 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 1 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 2 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 3 }) });
    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 4 }) });

    expect(observed.observers.finish()).toHaveLength(4);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 44 }], [{ position: 62 }], [{ position: 97 }]]);
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
    { name: "an as widening", source: "candidate as unknown;\n", snippet: "candidate as unknown; " },
    { name: "an angle-bracket widening", source: "<unknown>candidate;\n", snippet: "<unknown>candidate; " },
  ])("flags $name to unknown", ({ source, snippet }) => {
    const observed = sourceObservations({ source });

    observed.observers.enter?.({ node: statementCast({ tree: observed.tree, index: 0 }) });

    expect(observed.observers.finish()).toEqual([{ clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet }]);
  });

  it("flags a double cast through unknown with its own message, and its unknown half", () => {
    const observed = sourceObservations({ source: "rows as unknown as ReadonlyArray<RowShape>;\n" });
    const outer = statementCast({ tree: observed.tree, index: 0 });

    observed.observers.enter?.({ node: outer });
    observed.observers.enter?.({ node: outer.getChildAt(0, observed.tree) });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: `${THROUGH_UNKNOWN_MESSAGE}: rows as unknown as ReadonlyArray<RowShape>; ` },
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "rows as unknown as ReadonlyArray<RowShape>; " },
    ]);
  });

  it("leaves every cast whose type carries any to CD-1, including one nested in a multi-argument generic", () => {
    const observed = sourceObservations({ source: "candidate as any;\ncandidate as Map<string, any>;\n" });
    const anyCast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const genericCast = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: anyCast });
    observed.observers.enter?.({ node: genericCast });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});
