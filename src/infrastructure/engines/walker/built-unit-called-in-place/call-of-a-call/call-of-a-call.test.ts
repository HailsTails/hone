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
import { check } from "./call-of-a-call.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "built-unit-called-in-place#call-of-a-call",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/built-unit-called-in-place/call-of-a-call",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "call-of-a-call.ts" },
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

describe("call of a call", () => {
  it("flags immediate calls after construction with an object literal", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source: "checkoutOf({ clock })({ order });\n(anotherOf(1, ({ clock })))(order);",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "checkoutOf",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 1 },
          snippet: "anotherOf",
        },
      ],
    });
  });

  it("passes a named unit, variable and array arguments and immediately invoked functions", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'const checkout = checkoutOf({ clock });\ncheckout(order);\ncheckoutOf(ports)(order);\nit.each([1])("order", () => {});\n(() => run())();',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("reports the innermost immediate construction once in a chain", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source: "checkoutOf({ clock })({ order })(item);",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "checkoutOf",
        },
      ],
    });
  });

  it("flags construction in production source files", async () => {
    const file = repoPathSchema.parse("src/orders.ts");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file,
        source: "checkoutOf({ clock })(order);",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        { file, check: BINDING.address, anchor: { line: 1, column: 0 }, snippet: "checkoutOf" },
      ],
    });
  });

  it.each(["src/orders.d.ts", "dist/orders.ts"])("skips %s", async (name) => {
    const file = repoPathSchema.parse(name);
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file,
        source: "checkoutOf({ clock })(order);",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
