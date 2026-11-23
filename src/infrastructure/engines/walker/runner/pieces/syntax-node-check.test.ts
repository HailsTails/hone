import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { observeWalkerFile } from "../observe-walker-file.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../toolchain/typescript-toolchain.ts";
import { testFileEligibility } from "./source-scope.ts";
import { syntaxNodeCheck } from "./syntax-node-check.ts";
import { textsDisk } from "./walker-disk.ts";
import type { WalkerPiece } from "./walker-piece.ts";

const TEST_FILE = repoPathOf("src/example.test.ts");
const BINDING: CheckBinding = {
  address: "example-symptom#example-check",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/example-symptom/example-check",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "example-check.ts" },
};

const piece = syntaxNodeCheck({
  eligibility: testFileEligibility,
  found: ({ syntaxApi, node }) =>
    syntaxApi.isIdentifier(node) && node.text === "sample"
      ? { at: node, snippet: "sample" }
      : undefined,
});

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

describe("syntaxNodeCheck", () => {
  it("attaches the visited anchor and check to matching nodes in eligible files", async () => {
    await expect(
      observeWalkerPiece({ piece, binding: BINDING, file: TEST_FILE, source: "const sample = 1;" }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 6 },
          snippet: "sample",
        },
      ],
    });
  });

  it("skips files outside its scope", async () => {
    await expect(
      observeWalkerPiece({
        piece,
        binding: BINDING,
        file: repoPathOf("src/example.ts"),
        source: "const sample = 1;",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
