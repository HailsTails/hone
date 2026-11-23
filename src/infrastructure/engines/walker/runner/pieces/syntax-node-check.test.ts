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
  readonly bindings: readonly CheckBinding[];
  readonly file: RepoPath;
  readonly source: string;
}): Promise<Result<readonly CheckHit[], RunnerFailure>> => {
  const { bindings } = request;
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
    pieces: [{ modulePath: BINDING.pieceRoot, bindings, check: prepared.value }],
    parse,
    escapes: [],
  });
  return observed.outcome === "failed" ? observed : { outcome: "ok", value: observed.value.hits };
};

describe("syntaxNodeCheck", () => {
  it("attaches the visited anchor and check to matching nodes in eligible files", async () => {
    await expect(
      observeWalkerPiece({
        piece,
        bindings: [BINDING],
        file: TEST_FILE,
        source: "const sample = 1;",
      }),
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
        bindings: [BINDING],
        file: repoPathOf("src/example.ts"),
        source: "const sample = 1;",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("flattens and caps a long multiline snippet at the original anchor", async () => {
    const piece = syntaxNodeCheck({
      eligibility: testFileEligibility,
      found: ({ syntaxApi, node, sourceFile }) =>
        syntaxApi.isVariableStatement(node)
          ? { at: node, snippet: node.getText(sourceFile) }
          : undefined,
    });
    await expect(
      observeWalkerPiece({
        piece,
        bindings: [BINDING],
        file: TEST_FILE,
        source:
          "  const answer = consume(\n    customerReconciliationEntriesWaitingForTheNextScheduledBillingCycleAndManualReview,\n    report,\n  );",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 2 },
          snippet:
            "const answer = consume( customerReconciliationEntriesWaitingForTheNextScheduledB…",
        },
      ],
    });
  });

  it("reports a matching node once per check binding", async () => {
    const other: CheckBinding = { ...BINDING, address: "example-symptom#other-check" };
    await expect(
      observeWalkerPiece({
        piece,
        bindings: [BINDING, other],
        file: TEST_FILE,
        source: "const sample = 1;",
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 6 },
          snippet: "sample",
        },
        {
          file: TEST_FILE,
          check: other.address,
          anchor: { line: 1, column: 6 },
          snippet: "sample",
        },
      ],
    });
  });

  it("skips an eligible file when no check binds to the piece", () => {
    const prepared = piece.prepare({
      bindings: [],
      repository: {
        files: [TEST_FILE],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
      },
      syntaxApi: parse.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    expect(
      prepared.value.prepareFile({
        file: TEST_FILE,
        readText: () => ({ outcome: "ok", value: "const sample = 1;" }),
      }),
    ).toEqual({ outcome: "ok", value: { kind: "skipped" } });
  });
});
