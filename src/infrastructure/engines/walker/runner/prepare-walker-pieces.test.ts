import { assert, describe, expect, it, vi } from "vitest";

import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../../domain/result.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { PieceFailure } from "../../../../domain/runner/piece-failure-types.ts";
import { textsDisk } from "./pieces/walker-disk.ts";
import type { PreparedWalkerCheck, WalkerPiece, WalkerRepository } from "./pieces/walker-piece.ts";
import { prepareWalkerPieces } from "./prepare-walker-pieces.ts";
import { defaultTypeScriptPeers, loadParsePort } from "./toolchain/typescript-toolchain.ts";

const PIECE_ROOT = "/install/mechanisms/audit/XX-1";
const FIRST_MODULE = "/install/mechanisms/audit/XX-1/first.ts";
const SECOND_MODULE = "/install/mechanisms/audit/XX-1/second.ts";
const ALPHA = repoPathOf("src/alpha.ts");
const BETA = repoPathOf("src/beta.ts");
const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const SYNTAX_API = loadedParsePort.value.syntaxApi;

const REPOSITORY: WalkerRepository = {
  files: [ALPHA, BETA],
  exists: () => "present",
  disk: textsDisk({ root: "/repo", texts: {} }),
};

const FIRST_CLAUSE: CheckBinding = {
  address: "example#first-check",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "first.ts" },
};

const SECOND_CLAUSE: CheckBinding = {
  address: "example#second-check",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "second.ts" },
};

const THIRD_CLAUSE: CheckBinding = {
  address: "example#third-check",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "first.ts" },
};

const preparedCheck = (): PreparedWalkerCheck => ({
  prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({
    outcome: "ok",
    value: { kind: "skipped" },
  }),
  finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({
    outcome: "ok",
    value: [],
  }),
});

describe("prepareWalkerPieces", () => {
  it("loads and prepares each distinct module once with its ordered bindings and returns every prepared piece in first-module encounter order", async () => {
    const firstCheck = preparedCheck();
    const secondCheck = preparedCheck();
    const firstPreparation = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: firstCheck,
    });
    const secondPreparation = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: secondCheck,
    });
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValueOnce({
        outcome: "ok",
        value: { check: { prepare: firstPreparation } },
      })
      .mockResolvedValueOnce({
        outcome: "ok",
        value: { check: { prepare: secondPreparation } },
      });

    const preparation = await prepareWalkerPieces({
      selected: [
        { modulePath: FIRST_MODULE, binding: FIRST_CLAUSE },
        { modulePath: SECOND_MODULE, binding: SECOND_CLAUSE },
        { modulePath: FIRST_MODULE, binding: THIRD_CLAUSE },
      ],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "ok",
      value: [
        {
          modulePath: FIRST_MODULE,
          bindings: [FIRST_CLAUSE, THIRD_CLAUSE],
          check: {
            prepareFile: expect.any(Function),
            finish: expect.any(Function),
          },
        },
        {
          modulePath: SECOND_MODULE,
          bindings: [SECOND_CLAUSE],
          check: {
            prepareFile: expect.any(Function),
            finish: expect.any(Function),
          },
        },
      ],
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith({ path: FIRST_MODULE });
    expect(load).toHaveBeenCalledWith({ path: SECOND_MODULE });
    expect(firstPreparation.mock.calls).toEqual([
      [
        {
          bindings: [FIRST_CLAUSE, THIRD_CLAUSE],
          repository: REPOSITORY,
          syntaxApi: SYNTAX_API,
        },
      ],
    ]);
    expect(secondPreparation.mock.calls).toEqual([
      [
        {
          bindings: [SECOND_CLAUSE],
          repository: REPOSITORY,
          syntaxApi: SYNTAX_API,
        },
      ],
    ]);
  });

  it("reports an unloadable module as piece-invalid with its piece root and loader detail", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "module-unloadable",
        path: FIRST_MODULE,
        detail: "SyntaxError",
      },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, binding: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: PIECE_ROOT,
        detail: "SyntaxError",
      },
    });
  });

  it.each([
    { name: "missing check export", namespace: {} },
    {
      name: "non-callable preparation",
      namespace: { check: { prepare: "prepare" } },
    },
  ])("reports a module with $name as piece-invalid", async ({ namespace }) => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: namespace,
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, binding: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: PIECE_ROOT,
        detail: expect.any(String),
      },
    });
  });

  it("propagates a failed preparation Result without replacing its affected-input failure", async () => {
    const failedPreparation: Result<PreparedWalkerCheck, PieceFailure> = {
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        file: ALPHA,
        detail: "EACCES",
      },
    };
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue(failedPreparation);
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: { check: { prepare } },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, binding: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        file: ALPHA,
        detail: "EACCES",
      },
    });
  });

  it("refuses a malformed prepared check returned by an otherwise callable piece", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        check: {
          prepare: () => ({
            outcome: "ok",
            value: { prepareFile: "prepareFile", finish: () => [] },
          }),
        },
      },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, binding: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("attributes a thrown piece preparation to that piece", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: { check: { prepare: () => assert.fail("preparation failed") } },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, binding: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "preparation failed" },
    });
  });
});
