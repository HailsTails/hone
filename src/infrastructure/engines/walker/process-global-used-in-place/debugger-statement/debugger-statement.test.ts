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
import { check } from "./debugger-statement.ts";

const SOURCE_FILE = repoPathSchema.parse("src/orders.ts");
const BINDING: CheckBinding = {
  address: "process-global-used-in-place#debugger-statement",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/process-global-used-in-place/debugger-statement",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "debugger-statement.ts" },
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

describe("the debugger statement check", () => {
  it("anchors each debugger statement at its keyword", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: SOURCE_FILE,
        source: "debugger;\nfunction run() {\n  debugger;\n}",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: SOURCE_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "debugger",
        },
        {
          file: SOURCE_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 2 },
          snippet: "debugger",
        },
      ],
    });
  });

  it("passes property names and quoted text that do not pause execution", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: SOURCE_FILE,
        source: 'const settings = { debugger: false };\nconst label = "debugger";',
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("scans module and test sources and skips generated and declaration files", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: repoPathSchema.parse("src/orders.test.mts"),
        source: "debugger;",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: repoPathSchema.parse("src/orders.test.mts"),
          check: BINDING.address,
          anchor: { line: 1, column: 0 },
          snippet: "debugger",
        },
      ],
    });
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: repoPathSchema.parse("dist/orders.ts"),
        source: "debugger;",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: repoPathSchema.parse("src/orders.d.cts"),
        source: "debugger;",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
