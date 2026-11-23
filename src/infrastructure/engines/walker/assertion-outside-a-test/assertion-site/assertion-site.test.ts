import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./assertion-site.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "assertion-outside-a-test#assertion-site",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/assertion-outside-a-test/assertion-site",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "assertion-site.ts" },
};

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const parse = loadedParse.value;

const observeWalkerPiece = async (request: {
  readonly piece: WalkerPiece;
  readonly binding: CheckBinding;
  readonly file: RepoPath;
  readonly source: string;
}): Promise<Result<readonly CheckHit[], RunnerFailure>> => {
  const bindings = [request.binding];
  const prepared = request.piece.prepare({
    bindings,
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
      testFiles: DEFAULT_TEST_FILES,
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [{ modulePath: request.binding.pieceRoot, bindings, check: prepared.value }],
    parse,
    escapes: [],
  });
  return observed.outcome === "failed" ? observed : { outcome: "ok", value: observed.value.hits };
};

describe("assertion sites", () => {
  it("reports assertions in suites and hooks while allowing asymmetric matchers", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'beforeEach(() => expect(order).toBeDefined());\ndescribe("suite", () => { assert.ok(order); });\nexpect.hasAssertions();\nconst type = expect.any(String);\nexpect.extend(matchers);',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 17 },
          snippet: "expect",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 26 },
          snippet: "assert",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 0 },
          snippet: "expect",
        },
      ],
    });
  });

  it("recognizes modified and table-driven tests as the assertion boundary", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'it.each([1])("case", () => { const prove = () => expect(order).toBeDefined(); prove(); });\ntest.concurrent("case", () => assert.ok(order));',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("recognizes namespace test members and a constant made by chaining extensions", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import * as vitest from "vitest";\nconst trial = vitest.test.extend(fixtures).extend(extraFixtures);\nvitest.it("case", () => expect(order));\nvitest["test"].concurrent("case", () => expect(order));\ntrial("case", () => expect(order));\nvitest.describe("suite", () => expect(order));',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 6, column: 31 },
          snippet: "expect",
        },
      ],
    });
  });

  it("resolves Vitest imports and ignores production assertions from other sources", async () => {
    const file = repoPathSchema.parse("src/helper.ts");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: file,
        source:
          'import assert from "node:assert/strict";\nimport { expect as verify } from "vitest";\nassert.ok(order);\nverify(order).toBeDefined();\nconst compare = (verify: Check) => verify(order);',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        { file: file, check: BINDING.address, anchor: { line: 4, column: 0 }, snippet: "verify" },
      ],
    });
  });

  it("recognizes a Vitest extension without treating shadowed or unrelated callbacks as tests", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import { test as base, it as should } from "vitest";\nimport { test as adapter } from "./runtime";\nconst myTest = base.extend(fixtures);\nconst chained = myTest.extend(otherFixtures);\nconst fake = adapter.extend(fixtures);\nbase("import", () => expect(order));\nshould("alias", () => expect(order));\nmyTest("extended", () => expect(order));\nchained("chain", () => expect(order));\nfunction outer(it: Test) { it("shadowed", () => expect(order)); }\nfunction inner(myTest: Test) { myTest("shadowed", () => expect(order)); }\nfake("adapter", () => expect(order));',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 10, column: 48 },
          snippet: "expect",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 11, column: 56 },
          snippet: "expect",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 12, column: 22 },
          snippet: "expect",
        },
      ],
    });
  });

  it("reports the Vitest expect methods that make assertions", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          "expect.soft(order);\nexpect.poll(readOrder);\nexpect.assertions(1);\nexpect.unreachable();",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "expect",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 0 },
          snippet: "expect",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 0 },
          snippet: "expect",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 4, column: 0 },
          snippet: "expect",
        },
      ],
    });
  });

  it("resolves assertion bindings in tests without treating an each table as a test body", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'import { expect as verify } from "vitest";\nconst expect = (order: Order) => order;\nexpect(order);\nit.each([() => verify(order)])("case", () => verify(order));\nit("case", { timeout: 100 }, () => verify(order));',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 4, column: 15 },
          snippet: "verify",
        },
      ],
    });
  });
});
