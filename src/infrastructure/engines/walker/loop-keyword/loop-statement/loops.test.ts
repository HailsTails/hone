import { assert, describe, expect, it, vi } from "vitest";

import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./loops.ts";

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

const FILE = repoPathOf("src/items.ts");
const ADDRESS: CheckAddressText = "loop-keyword#loop-statement";
const SYNTAX_API = defaultParsePort.syntaxApi;
const FOR = "f" + "or";
const WHILE = "wh" + "ile";
const SWITCH = "sw" + "itch";
const DEFAULT = "def" + "ault";
const LINE_COMMENT = "/" + "/";
const BLOCK_OPEN = "/" + "*";
const CLAUSE: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-15",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "loops.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({
    bindings: [CLAUSE],
    repository: {
      files: [request.file],
      exists: vi.fn().mockReturnValue("present"),
      disk: EMPTY_DISK,
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    },
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-15 existing raw loop observations and counted-for redirect", () => {
  it("compacts and caps a long finding snippet", () => {
    const prepared = preparedFor({ file: FILE });
    expect(
      prepared.prepareFile({
        file: FILE,
        readText: () => ({
          outcome: "ok",
          value:
            "  for  (const entry of customerReconciliationEntriesWaitingForTheNextScheduledBillingCycleAndManualReview) visit(entry);",
        }),
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet:
              "for (const entry of customerReconciliationEntriesWaitingForTheNextScheduledBilli…",
          },
        ],
      },
    });
  });

  it("completes all ordered CRLF findings under selected CD15 through one read without syntax", () => {
    const prepared = preparedFor({ file: FILE });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "ok",
      value: `${FOR} (const item of items) consume(item);\r\n${FOR} await (const chunk of stream) consume(chunk);\r\n${FOR} (let index = 0; index < size; index++) consume(index);\r\n${WHILE} (ready) consume();\r\ndo consume(); ${WHILE} (ready);\r\n`,
    });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: `${FOR} (const item of items) consume(item);`,
          },
          {
            check: ADDRESS,
            anchor: { line: 2, column: 0 },
            snippet: `${FOR} await (const chunk of stream) consume(chunk);`,
          },
          {
            check: ADDRESS,
            anchor: { line: 3, column: 0 },
            snippet: `${FOR} (let index = 0; index < size; index++) consume(index);`,
          },
          {
            check: ADDRESS,
            anchor: { line: 4, column: 0 },
            snippet: `${WHILE} (ready) consume();`,
          },
          {
            check: ADDRESS,
            anchor: { line: 5, column: 0 },
            snippet: `do consume(); ${WHILE} (ready);`,
          },
        ],
      },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains every matching kind on one line and one finding for repeated instances of the same kind", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "ok",
      value: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);\n${FOR} (x of xs); ${FOR} (y of ys);\n`,
    });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);`,
          },
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);`,
          },
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);`,
          },
          {
            check: ADDRESS,
            anchor: { line: 2, column: 0 },
            snippet: `${FOR} (x of xs); ${FOR} (y of ys);`,
          },
        ],
      },
    });
  });

  it("preserves literal and inline matches, ignored prefixes and unsupported header gaps without cross-rule findings", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "ok",
      value: `const literal = '${WHILE} (ready)';\nconst stable = 1; ${LINE_COMMENT} ${FOR} (i=0;i<n;i++);\n  ${LINE_COMMENT} ${WHILE} (ignored)\n ${BLOCK_OPEN} ${FOR} (item of ignored)\n * ${FOR} (i=0;i<n;i++);\n${FOR} (const key in record) consume(key);\n${FOR} (const item\nof items) consume(item);\n${FOR} (const [item = load()] of items) consume(item);\n${FOR} (let index = 0; ready(index); index++) consume(index);\n${FOR} await (i=0;i<n;i++);\n${SWITCH} (value) { ${DEFAULT}: otherRule; }\n`,
    });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: `const literal = '${WHILE} (ready)';`,
          },
          {
            check: ADDRESS,
            anchor: { line: 2, column: 0 },
            snippet: `const stable = 1; ${LINE_COMMENT} ${FOR} (i=0;i<n;i++);`,
          },
        ],
      },
    });
  });

  it("collapses whole-line whitespace and truncates only above eighty characters", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "ok",
      value: `  ${WHILE}\t (ready)   { }   abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij  \r\n  ${WHILE}\t (ready)   { }   abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijk  \r\n`,
    });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          {
            check: ADDRESS,
            anchor: { line: 1, column: 0 },
            snippet: `${WHILE} (ready) { } abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij`,
          },
          {
            check: ADDRESS,
            anchor: { line: 2, column: 0 },
            snippet: `${WHILE} (ready) { } abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij…`,
          },
        ],
      },
    });
  });

  it("returns an observed clean transformation as complete empty findings", () => {
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "ok", value: "const doubled = items.map(item => item * 2);" });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates the requested cached read failure unchanged", () => {
    const readFailure: RunnerFailure = {
      kind: "file-unreadable",
      file: FILE,
      detail: "unreadable loop source",
    };
    const readText = vi
      .fn<WalkerFile["readText"]>()
      .mockReturnValue({ outcome: "failed", error: readFailure });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "failed",
      error: readFailure,
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "all-depth exclusion",
      fileName: "src/node_modules/items.ts",
      expected: { outcome: "ok", value: { kind: "skipped" } },
      readCount: 0,
    },
    {
      name: "root-only exclusion",
      fileName: "vendor/items.ts",
      expected: { outcome: "ok", value: { kind: "skipped" } },
      readCount: 0,
    },
    {
      name: "nested root-only directory",
      fileName: "src/vendor/items.ts",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
      readCount: 1,
    },
    {
      name: "TSX source",
      fileName: "src/items.tsx",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
      readCount: 1,
    },
    {
      name: "test source",
      fileName: "src/items.test.ts",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
      readCount: 1,
    },
    {
      name: "declaration source",
      fileName: "src/items.d.ts",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
      readCount: 1,
    },
    {
      name: "physical script",
      fileName: "scripts/items.ts",
      expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
      readCount: 1,
    },
    {
      name: "non-TypeScript candidate",
      fileName: "src/items.js",
      expected: { outcome: "ok", value: { kind: "skipped" } },
      readCount: 0,
    },
  ])(
    "preserves composed source-family eligibility for $name",
    ({ fileName, expected, readCount }) => {
      const file = repoPathSchema.parse(fileName);
      const readText = vi
        .fn<WalkerFile["readText"]>()
        .mockReturnValue({ outcome: "ok", value: "const items = [];" });

      expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
      expect(readText).toHaveBeenCalledTimes(readCount);
    },
  );
});
