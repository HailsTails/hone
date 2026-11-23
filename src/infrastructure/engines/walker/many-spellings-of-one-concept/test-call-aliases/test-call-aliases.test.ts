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
import { check } from "./test-call-aliases.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "many-spellings-of-one-concept#test-call-aliases",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/many-spellings-of-one-concept/test-call-aliases",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-call-aliases.ts" },
};

const loaded = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loaded.outcome === "ok");
const parse = loaded.value;

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
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath:
          "/install/walker/many-spellings-of-one-concept/test-call-aliases/test-call-aliases.ts",
        bindings: [BINDING],
        check: prepared.value,
      },
    ],
    parse,
    escapes: [],
  });
  assert(observed.outcome === "ok");
  return observed.value.hits;
};

describe("the test-call aliases check", () => {
  it("reports the tagged table form and a non-null root once each", () => {
    expect(
      findingsIn({
        file: TEST_FILE,
        source: "test.each`name | expected`('table', fn);\ntest!('case', fn);",
      }),
    ).toEqual([
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 1, column: 0 }, snippet: "test" },
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 2, column: 0 }, snippet: "test" },
    ]);
  });

  it.each([
    'import type { test } from "vitest";\ntest("case", fn);',
    'import { type test } from "vitest";\ntest("case", fn);',
    'import * as v from "vitest";\nv.test("case", fn);',
    'import * as test from "vitest";\ntest.it("case", fn);',
    'import test = require("vitest");\ntest.it("case", fn);',
    'import { expect as test } from "vitest";\ntest(value);',
  ])("passes an import that introduces no test alias in %s", (source) => {
    expect(findingsIn({ file: TEST_FILE, source })).toEqual([]);
  });

  it("flags unbound aliases and anchors each call once at its root identifier", () => {
    expect(
      findingsIn({
        file: TEST_FILE,
        source:
          'test("order", () => {});\nsuite.skip("orders", () => {});\ntest.each([1])("order", () => {});',
      }),
    ).toEqual([
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 1, column: 0 }, snippet: "test" },
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 2, column: 0 }, snippet: "suite" },
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 3, column: 0 }, snippet: "test" },
    ]);
  });

  it("flags calls through Vitest imports even when aliases wrap member calls", () => {
    expect(
      findingsIn({
        file: TEST_FILE,
        source:
          'import { test, describe as suite } from "vitest";\n(test)["skip"]("x", () => {});\nsuite("x", () => {});',
      }),
    ).toEqual([
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 2, column: 1 }, snippet: "test" },
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 3, column: 0 }, snippet: "suite" },
    ]);
  });

  it("passes the standard spellings and bindings from other modules", () => {
    expect(
      findingsIn({
        file: TEST_FILE,
        source:
          'import { suite } from "./tools.ts";\nimport { it, describe } from "vitest";\nsuite();\ndescribe("orders", () => it("sends", () => {}));',
      }),
    ).toEqual([]);
  });

  it("passes locals and shadowing bindings and still flags the Vitest import outside the shadow", () => {
    expect(
      findingsIn({
        file: TEST_FILE,
        source:
          'import { test } from "vitest";\n{ suite(); const suite = prepareSuite(); }\nconst run = ({ test }: Tools) => test();\nconst work = () => { test(); function test() {} };\ntest("orders", () => {});',
      }),
    ).toEqual([
      { file: TEST_FILE, check: BINDING.address, anchor: { line: 5, column: 0 }, snippet: "test" },
    ]);
  });

  it("skips production and generated files", () => {
    expect(findingsIn({ file: repoPathSchema.parse("src/orders.ts"), source: "test();" })).toEqual(
      [],
    );
    expect(
      findingsIn({ file: repoPathSchema.parse("dist/orders.test.ts"), source: "test();" }),
    ).toEqual([]);
  });
});
