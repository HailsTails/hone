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
import { check } from "./test-type-declaration.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "type-declared-in-a-test#test-type-declaration",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/type-declared-in-a-test/test-type-declaration",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-type-declaration.ts" },
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

describe("test-type declarations", () => {
  it("finds type aliases, interfaces and enums inside a test file", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source: "type Amount = number;\ninterface Item { amount: Amount }\nenum State { Sent }",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "Amount",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 0 },
          snippet: "Item",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 0 },
          snippet: "State",
        },
      ],
    });
  });

  it("finds type declarations in a TSX test", async () => {
    const file = repoPathSchema.parse("src/orders.test.tsx");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file,
        source: 'it("checks an order", () => {\n  type Amount = number;\n});',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file,
          check: BINDING.address,
          anchor: { line: 2, column: 2 },
          snippet: "Amount",
        },
      ],
    });
  });

  it.each(["src/orders.ts", "src/orders.test.mts", "src/orders.test.cts"])(
    "leaves a type declaration in %s outside the existing test-file scope",
    async (name) => {
      const file = repoPathSchema.parse(name);
      await expect(
        observeWalkerPiece({
          piece: check,
          binding: BINDING,
          file,
          source: "type Amount = number;",
        }),
      ).resolves.toEqual({ outcome: "ok", value: [] });
    },
  );

  it("passes inline type shapes in a test", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source: "const input: { amount: number } = { amount: 1 };",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("passes module and global augmentations while reporting local type declarations", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'export {};\ndeclare module "./orders.ts" { interface Order { priority: number } }\ndeclare global { interface Window { order: Order } }\nnamespace Fixtures { export type Amount = number; }',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 4, column: 21 },
          snippet: "Amount",
        },
      ],
    });
  });
});
