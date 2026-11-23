import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
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
  checkSettings: {},
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
}): readonly CheckHit[] => {
  const prepared = check.prepare({
    bindings: [BINDING],
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const result = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath: "/install/walker/prose-in-code/comment-prose/prose-in-code.ts",
        bindings: [BINDING],
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
  it("reports line comments, block comments, and JSDoc at the opening delimiter", () => {
    expect(
      findingsIn({
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
        file: SOURCE_FILE,
        source:
          "/// <reference types=\"node\" />\n// TODO(spec-42)\n// @ts-expect-error (spec-42)\nexport const answer: number = 'wrong';",
      }),
    ).toEqual([]);
  });

  it("ignores comment markers in string literals", () => {
    expect(findingsIn({ file: SOURCE_FILE, source: "const heading = '// A string';" })).toEqual([]);
  });

  it("does not read JavaScript comments in a TypeScript check", () => {
    expect(
      findingsIn({
        file: repoPathSchema.parse("src/build-order.js"),
        source: "// An explanation\nconst order = 1;",
      }),
    ).toEqual([]);
  });
});
