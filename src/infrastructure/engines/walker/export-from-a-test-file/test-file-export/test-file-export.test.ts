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
import { check } from "./test-file-export.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "export-from-a-test-file#test-file-export",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/export-from-a-test-file/test-file-export",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-file-export.ts" },
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

describe("test-file exports", () => {
  it("locates named, type, default and assignment exports in a test", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'export const value = 1;\nexport type { Input } from "./unit.ts";\nexport default value;\nexport = value;',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "export",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 0 },
          snippet: "export",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 0 },
          snippet: "export",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 4, column: 0 },
          snippet: "export",
        },
      ],
    });
  });

  it("finds an export in a TSX test", async () => {
    const file = repoPathSchema.parse("src/order.test.tsx");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file,
        source: "export const order = 1;",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [{ file, check: BINDING.address, anchor: { line: 1, column: 0 }, snippet: "export" }],
    });
  });

  it.each(["src/order.test.mts", "src/order.test.cts"])(
    "leaves %s outside the existing test-file scope",
    async (name) => {
      const file = repoPathSchema.parse(name);
      await expect(
        observeWalkerPiece({
          piece: check,
          binding: BINDING,
          file,
          source: "export const order = 1;",
        }),
      ).resolves.toEqual({ outcome: "ok", value: [] });
    },
  );

  it("passes exports in production, export text and empty module markers in tests", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source: 'const message = "export default 1";\nexport {};',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
    const file = repoPathSchema.parse("src/orders.ts");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: file,
        source: "export default 1;",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("passes exports inside a local namespace or module augmentation", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'namespace Local { export const value = 1; }\ndeclare module "vitest" { export interface TestContext {} }',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
