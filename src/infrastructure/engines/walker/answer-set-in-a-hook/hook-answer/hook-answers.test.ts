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
import { check } from "./hook-answers.ts";

const SOURCE_FILE = repoPathSchema.parse("src/read-order.test.ts");
const BINDING: CheckBinding = {
  address: "answer-set-in-a-hook#hook-answer",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/answer-set-in-a-hook/hook-answer",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "hook-answers.ts" },
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
        modulePath: "/install/walker/answer-set-in-a-hook/hook-answer/hook-answers.ts",
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

describe("answers set in a hook", () => {
  it("reports return values and implementations set inside lifecycle callbacks", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          "beforeEach(() => {\n  stub.mockResolvedValue('order');\n});\nafterEach(() => {\n  stub.mockImplementation(() => 'next');\n});",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 2 },
        snippet: "stub.mockResolvedValue('order')",
      },
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 5, column: 2 },
        snippet: "stub.mockImplementation(() => 'next')",
      },
    ]);
  });

  it("passes a plain afterEach reset and an answer that a test supplies", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          "afterEach(() => stub.mockReset());\nit('runs', () => { stub.mockReturnValue('order'); });",
      }),
    ).toEqual([]);
  });

  it("reports a stub created with an implementation inside a hook", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "beforeEach(() => { stub = vi.fn(() => 'x'); });",
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 1, column: 26 },
        snippet: "vi.fn(() => 'x')",
      },
    ]);
  });

  it("passes a stub declaration without an implementation", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "beforeEach(() => { stub = vi.fn(); });",
      }),
    ).toEqual([]);
  });

  it("caps a multiline stub answer at eighty characters", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source:
          'beforeEach(() => {\r\n  stub.mockReturnValue(\r\n    "1234567890123456789012345678901234567890123456789012345678901234",\r\n  );\r\n});',
      }),
    ).toEqual([
      {
        file: SOURCE_FILE,
        check: BINDING.address,
        anchor: { line: 2, column: 2 },
        snippet:
          'stub.mockReturnValue( "123456789012345678901234567890123456789012345678901234567…',
      },
    ]);
  });

  it("skips a spec suffix outside the test-file scope", () => {
    expect(
      findingsIn({
        file: repoPathSchema.parse("src/order.spec.ts"),
        source: "beforeEach(() => stub.mockReturnValue('order'));",
      }),
    ).toEqual([]);
  });

  it("leaves named callbacks outside the inline hook check", () => {
    expect(
      findingsIn({
        file: SOURCE_FILE,
        source: "const prepare = () => stub.mockReturnValue('order');\nbeforeEach(prepare);",
      }),
    ).toEqual([]);
  });
});
