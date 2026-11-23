import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./prose-in-code.ts";

const SOURCE_FILE = repoPathSchema.parse("src/build-order.ts");
const BINDING: CheckBinding = {
  address: "prose-in-code#comment-prose",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/prose-in-code/comment-prose",
  checkSettings: {
    trackerPatterns: [
      "^\\((?:#[1-9]\\d*|[A-Za-z][\\w-]*-[1-9]\\d*|[Hh][Tt][Tt][Pp][Ss]?://\\S+)\\)$",
    ],
  },
  edition: FIRST_EDITION,
  settings: { module: "prose-in-code.ts" },
};

const parsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(parsePort.outcome === "ok");
const parse = parsePort.value;

const findingsIn = (request: {
  readonly file: RepoPath;
  readonly source: string;
  readonly bindings: readonly CheckBinding[];
}): readonly CheckHit[] => {
  const prepared = check.prepare({
    bindings: request.bindings,
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const result = observeWalkerFile({
    file: {
      file: request.file,
      readText: () => ({ outcome: "ok", value: request.source }),
    },
    pieces: [
      {
        modulePath: "/install/walker/prose-in-code/comment-prose/prose-in-code.ts",
        bindings: request.bindings,
        check: prepared.value,
      },
    ],
    parse,
    escapes: [],
  });
  assert(result.outcome === "ok");
  return result.value.hits;
};

describe("prose in code", () => {
  it("fails preparation when a tracker pattern is invalid", () => {
    expect(
      check.prepare({
        bindings: [{ ...BINDING, checkSettings: { trackerPatterns: ["("] } }],
        repository: {
          files: [SOURCE_FILE],
          exists: () => "present",
          disk: textsDisk({ root: "/repo", texts: {} }),
          testFiles: DEFAULT_TEST_FILES,
        },
        syntaxApi: parse.syntaxApi,
      }),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: BINDING.pieceRoot,
      },
    });
  });

  it("reports line comments, block comments, and JSDoc at the opening delimiter", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source:
          "// Explains the name.\n/* Explains the value. */\n/** Explains the type. */\nexport const order = 1;",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "// Explains the name.",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "/* Explains the value. */",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "/** Explains the type. */",
      },
    ]);
  });

  it("allows tracked TODOs and recognised tool directives", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source:
          "/// <reference types=\"node\" />\n// TODO(spec-42)\n// @ts-expect-error (spec-42)\nexport const answer: number = 'wrong';",
      }),
    ).toEqual([]);
  });

  it("recognises environment, optimiser, bundler and licence directives", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source:
          '// \u0040vitest-environment jsdom\nconst value = /* @__PURE__ */ build();\nconst load = () => import(/* webpackChunkName: "order" */ "./order.ts");\n/*! license GPL-3.0 */\n/* eslint-env node */',
      }),
    ).toEqual([]);
  });

  it("requires a tracker reference and allows URLs without an issue number", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source: "// TODO(v2)\n// TODO(2025)\n// TODO(https://example.test/issues)\n// TODO (#16)",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "// TODO(v2)",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "// TODO(2025)",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "// TODO (#16)",
      },
    ]);
  });

  it("passes pure annotations, preservation notices and Vitest environment options", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source:
          "// \u0040vitest-environment-options {}\n/*! @preserve license */\nexport const order = /*#__PURE__*/ createOrder();",
      }),
    ).toEqual([]);
  });

  it("reports extra parenthesised TODO text and prose that resembles a licence notice", () => {
    const binding = { ...BINDING, checkSettings: { trackerPatterns: [".*"] } };
    expect(
      findingsIn({
        bindings: [binding],
        file: SOURCE_FILE,
        source:
          "// TODO(https://example.test/1)(becauseTheSourceChanged)\n/* TODO(https://example.test/issues) */\n/* TODO(legacy) */\n/*! license: the fallback handles this */\n/*! license the fallback handles this */\n/* @__PURE__ explains why */",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet: "// TODO(https://example.test/1)(becauseTheSourceChanged)",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "/* TODO(legacy) */",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 4, column: 0 },
        snippet: "/*! license: the fallback handles this */",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 0 },
        snippet: "/*! license the fallback handles this */",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 6, column: 0 },
        snippet: "/* @__PURE__ explains why */",
      },
    ]);
  });

  it("uses the configured tracker and reports any words following a valid pointer", () => {
    const binding = {
      ...BINDING,
      checkSettings: { trackerPatterns: ["^\\(OPS-\\d+\\)$"] },
    };
    expect(
      findingsIn({
        bindings: [binding],
        file: SOURCE_FILE,
        source: "// TODO(OPS-18)\n// TODO(OTHER-18)\n// TODO(OPS-18) because retry may fail",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "// TODO(OTHER-18)",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "// TODO(OPS-18) because retry may fail",
      },
    ]);
  });

  it("bounds a multiline comment to the source snippet width", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source:
          "/* Long comment\r\n   1234567890123456789012345678901234567890123456789012345678901234567890 */",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 0 },
        snippet:
          "/* Long comment 1234567890123456789012345678901234567890123456789012345678901234…",
      },
    ]);
  });

  it("ignores comment markers in string literals", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source: "const heading = '// A string';",
      }),
    ).toEqual([]);
  });

  it("does not read JavaScript comments in a TypeScript check", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: repoPathSchema.parse("src/build-order.js"),
        source: "// An explanation\nconst order = 1;",
      }),
    ).toEqual([]);
  });

  it("reports a TODO only to the binding whose tracker does not match", () => {
    const other: CheckBinding = {
      ...BINDING,
      address: "prose-in-code#other-comment",
      checkSettings: { trackerPatterns: ["^\\(TEAM-\\d+\\)$"] },
    };
    expect(
      findingsIn({
        bindings: [BINDING, other],
        file: SOURCE_FILE,
        source: "// TODO(OPS-18)",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: other.address,
        anchor: { line: 1, column: 0 },
        snippet: "// TODO(OPS-18)",
      },
    ]);
  });

  it("reports malformed Vitest options and webpack annotations", () => {
    expect(
      findingsIn({
        bindings: [BINDING],
        file: SOURCE_FILE,
        source:
          '// \u0040vitest-environment-options { "url": "https://example.test" }\n// \u0040vitest-environment-options { explains why }\n/* webpackChunkName: explains why */',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 0 },
        snippet: "// \u0040vitest-environment-options { explains why }",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 3, column: 0 },
        snippet: "/* webpackChunkName: explains why */",
      },
    ]);
  });
});
