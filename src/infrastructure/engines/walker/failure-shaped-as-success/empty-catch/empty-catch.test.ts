import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./empty-catch.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const BINDING: CheckBinding = {
  address: "failure-shaped-as-success#empty-catch",
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/failure-shaped-as-success/empty-catch",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "empty-catch.ts" },
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

describe("empty catch", () => {
  it("finds catch clauses and empty promise rejection callbacks", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          'try { save(); } catch (error) { /* ignored */ }\nload().catch(() => {});\nload()["then"](useOrder, function () {});',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 1, column: 16 },
          snippet: "catch",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 2, column: 7 },
          snippet: "catch",
        },
        {
          file: TEST_FILE,
          check: BINDING.address,
          anchor: { line: 3, column: 7 },
          snippet: "then",
        },
      ],
    });
  });

  it("passes a nonempty handler, a handler reference and an empty success callback", async () => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: TEST_FILE,
        source:
          "try { save(); } catch { return failure; }\nload().catch(toFailure);\nload().then(() => {});\nload().then(useOrder, () => failure);",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("finds an empty rejection handler accessed by a string in production code", async () => {
    const file = repoPathSchema.parse("src/orders.ts");
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file,
        source: 'load()["catch"](() => {});',
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [{ file, check: BINDING.address, anchor: { line: 1, column: 7 }, snippet: "catch" }],
    });
  });

  it.each(["dist/orders.ts", "src/orders.d.ts"])("skips %s", async (name) => {
    await expect(
      observeWalkerPiece({
        piece: check,
        binding: BINDING,
        file: repoPathSchema.parse(name),
        source: "load().catch(() => {});",
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
