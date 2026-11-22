import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import type { RunRequest } from "../../../../application/ports/engine/runner-module.ts";
import type { EntryKindPort } from "../../../../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { CASE_ROOT } from "./pieces/walker-disk.ts";
import type { PreparedWalkerCheck, WalkerPiece } from "./pieces/walker-piece.ts";
import { defaultTypeScriptPeers, loadParsePort } from "./toolchain/typescript-toolchain.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../..`, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const defaultParsePort = loadedParsePort.value;

const PIECE_ROOT = "/install/mechanisms/audit/XX-1";
const ALPHA = repoPathOf("src/alpha.ts");
const CONFIG = repoPathOf("tsconfig.json");
const FIRST = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("XX-1"), clause: clauseIdOf("first-check") };
const SECOND = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("XX-1"), clause: clauseIdOf("second-check") };

const clauseFor = (request: { readonly address: typeof FIRST; readonly module: string }): RunnerClause => ({
  address: request.address,
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { module: request.module },
});

const FIRST_CLAUSE = clauseFor({ address: FIRST, module: "shared.ts" });
const SECOND_CLAUSE = clauseFor({ address: SECOND, module: "shared.ts" });

const RUN: RunRequest = {
  repoRoot: absoluteRootOf("/repo"),
  installRoot: absoluteRootOf("/install"),
  files: [ALPHA],
  trackedPaths: [ALPHA, CONFIG],
  clauses: [FIRST_CLAUSE, SECOND_CLAUSE],
};

const SOURCE = "const a = 1;\nlet b = 2;\n";

const fileTextOf = (request: { readonly read: FileTextPort["read"] }): FileTextPort => ({
  read: request.read,
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const modulesOf = (request: { readonly check: unknown }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { check: request.check } }),
});

const LET_POSITION = 13;

const letKeywordPiece: WalkerPiece = {
  prepare: () => ({
    outcome: "ok",
    value: {
      prepareFile: vi
        .fn<PreparedWalkerCheck["prepareFile"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ anchorAt }) => ({
              finish: () => [
                { clause: FIRST, anchor: anchorAt({ position: LET_POSITION }), snippet: "let b = 2;" },
                { clause: FIRST, anchor: anchorAt({ position: 0 }), snippet: "const a = 1;" },
                { clause: SECOND, anchor: anchorAt({ position: LET_POSITION }), snippet: "let b = 2;" },
                { clause: SECOND, anchor: anchorAt({ position: 0 }), snippet: "const a = 1;" },
              ],
            }),
          },
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: { kind: "complete", hits: [{ clause: FIRST, anchor: { line: 1, column: 0 }, snippet: CONFIG }] },
        })
        .mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
      finish: () => ({
        outcome: "ok",
        value: [{ clause: SECOND, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: "repository-wide" }],
      }),
    },
  }),
};

const firstClauseLetKeywordPiece: WalkerPiece = {
  prepare: () => ({
    outcome: "ok",
    value: {
      prepareFile: vi
        .fn<PreparedWalkerCheck["prepareFile"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ anchorAt }) => ({
              finish: () => [
                { clause: FIRST, anchor: anchorAt({ position: LET_POSITION }), snippet: "let b = 2;" },
                { clause: FIRST, anchor: anchorAt({ position: 0 }), snippet: "const a = 1;" },
              ],
            }),
          },
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: { kind: "complete", hits: [{ clause: FIRST, anchor: { line: 1, column: 0 }, snippet: CONFIG }] },
        })
        .mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
      finish: () => ({
        outcome: "ok",
        value: [{ clause: SECOND, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: "repository-wide" }],
      }),
    },
  }),
};

const runnerWith = (request: { readonly fileText: FileTextPort; readonly modules: ModuleLoaderPort }) =>
  createWalkerRunner({
    fileText: request.fileText,
    modules: request.modules,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    parse: defaultParsePort,
    entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>().mockReturnValue("absent") },
  });

const skippingPrepare = () =>
  vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
    outcome: "ok",
    value: {
      prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
      finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] }),
    },
  });

describe("createWalkerRunner run", () => {
  it("walks every tracked path and reports each file's hits in source then clause order, then each piece's finishing hits", async () => {
    const runner = runnerWith({
      fileText: fileTextOf({ read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: SOURCE }) }),
      modules: modulesOf({ check: letKeywordPiece }),
    });

    expect(await runner.run(RUN)).toEqual({
      outcome: "ok",
      value: {
        hits: [
          { clause: FIRST, file: ALPHA, anchor: { line: 1, column: 0 }, snippet: "const a = 1;" },
          { clause: SECOND, file: ALPHA, anchor: { line: 1, column: 0 }, snippet: "const a = 1;" },
          { clause: FIRST, file: ALPHA, anchor: { line: 2, column: 0 }, snippet: "let b = 2;" },
          { clause: SECOND, file: ALPHA, anchor: { line: 2, column: 0 }, snippet: "let b = 2;" },
          { clause: FIRST, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: CONFIG },
          { clause: SECOND, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: "repository-wide" },
        ],
        nativeExceptions: [],
        measured: [
          { clause: FIRST, file: ALPHA },
          { clause: SECOND, file: ALPHA },
          { clause: FIRST, file: CONFIG },
          { clause: SECOND, file: CONFIG },
        ],
      },
    });
  });

  it("names no clause measured on a file every piece skipped, such as a file that is not TypeScript", async () => {
    expect(
      await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: { prepare: skippingPrepare() } }) }).run(RUN),
    ).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [] } });
  });

  it("reads a file under the repository root", async () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: SOURCE });

    await runnerWith({ fileText: fileTextOf({ read }), modules: modulesOf({ check: letKeywordPiece }) }).run(RUN);

    expect(read.mock.calls).toEqual([[{ path: "/repo/src/alpha.ts" }]]);
  });

  it("loads a module two clauses share once from the piece folder and prepares it with both clauses over the tracked paths", async () => {
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: {
        prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
        finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] }),
      },
    });
    const modules = modulesOf({ check: { prepare } });

    await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules }).run(RUN);

    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: `${PIECE_ROOT}/shared.ts` });
    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        clauses: [FIRST_CLAUSE, SECOND_CLAUSE],
        repository: expect.objectContaining({ files: [ALPHA, CONFIG] }),
      }),
    );
  });

  it("prepares each piece over the disk around the repository root", async () => {
    const prepare = skippingPrepare();

    await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: { prepare } }) }).run(RUN);

    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ repository: expect.objectContaining({ disk: expect.objectContaining({ root: "/repo" }) }) }),
    );
  });

  it("is piece-invalid without loading anything when a clause's settings name a module outside its piece folder", async () => {
    const modules = modulesOf({ check: letKeywordPiece });

    const outcome = await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules }).run({
      ...RUN,
      clauses: [clauseFor({ address: FIRST, module: "../escape.ts" })],
    });

    expect(outcome).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
    expect(modules.load).not.toHaveBeenCalled();
  });

  it("is file-unreadable with the port's detail when a file a piece reads cannot be read", async () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/src/alpha.ts", detail: "denied" } });

    expect(
      await runnerWith({ fileText: fileTextOf({ read }), modules: modulesOf({ check: letKeywordPiece }) }).run(RUN),
    ).toEqual({ outcome: "failed", error: { kind: "file-unreadable", file: ALPHA, detail: "denied" } });
  });

  it("is piece-invalid when a piece's finish throws", async () => {
    const throwingPiece: WalkerPiece = {
      prepare: () => ({
        outcome: "ok",
        value: {
          prepareFile: () => ({ outcome: "ok", value: { kind: "skipped" } }),
          finish: () => assert.fail("finish broke"),
        },
      }),
    };

    expect(
      await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: throwingPiece }) }).run(RUN),
    ).toEqual({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "finish broke" } });
  });
});

const EXPECTATION = "@ts-expect-" + "error";
const IGNORE = "@ts-" + "ignore";
const NOCHECK = "@ts-" + "nocheck";
const BETA = repoPathOf("src/beta.ts");
const SKIPPED = repoPathOf("src/skipped.ts");

const DIRECTIVE_SOURCE = `// ${NOCHECK}\n// ${EXPECTATION} legacy\nexport const a: number = "x";\n// ${IGNORE} reason (#42)\nexport const b = 1;\n// ordinary\n`;

type PreparedFile = ReturnType<PreparedWalkerCheck["prepareFile"]>;

const SYNTAX_FILE: PreparedFile = { outcome: "ok", value: { kind: "syntax", begin: () => ({ finish: () => [] }) } };

const SKIPPED_FILE: PreparedFile = { outcome: "ok", value: { kind: "skipped" } };

const pieceReadingAlphaThenBeta = (): WalkerPiece => ({
  prepare: vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
    outcome: "ok",
    value: {
      prepareFile: vi
        .fn<PreparedWalkerCheck["prepareFile"]>()
        .mockReturnValueOnce(SYNTAX_FILE)
        .mockReturnValueOnce(SYNTAX_FILE)
        .mockReturnValue(SKIPPED_FILE),
      finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] }),
    },
  }),
});

const escapingClause = (request: { readonly address: typeof FIRST; readonly escapingDirectives: readonly string[] }): RunnerClause => ({
  ...clauseFor({ address: request.address, module: "shared.ts" }),
  settings: { module: "shared.ts", escapingDirectives: request.escapingDirectives },
});

const directiveRun = (request: { readonly clauses: readonly RunnerClause[] }) =>
  runnerWith({
    fileText: fileTextOf({ read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: DIRECTIVE_SOURCE }) }),
    modules: modulesOf({ check: pieceReadingAlphaThenBeta() }),
  }).run({ ...RUN, files: [ALPHA, BETA, SKIPPED], trackedPaths: [ALPHA, BETA, SKIPPED, CONFIG], clauses: request.clauses });

const inlineDisable = (request: { readonly clause: typeof FIRST; readonly file: typeof ALPHA; readonly line: number; readonly text: string }) => ({
  kind: "inline-disable",
  ...request,
  reach: "one-clause",
});

const BOTH_CLAUSES_ON_ALPHA_AND_BETA = [
  { clause: FIRST, file: ALPHA },
  { clause: SECOND, file: ALPHA },
  { clause: FIRST, file: BETA },
  { clause: SECOND, file: BETA },
];

describe("createWalkerRunner run, type directives a clause declares as its escapes", () => {
  it("reports each declared directive, tracked reference or not, as an inline disable of that clause in every file its piece reads", async () => {
    expect(await directiveRun({ clauses: [escapingClause({ address: FIRST, escapingDirectives: [EXPECTATION, IGNORE, NOCHECK] })] })).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          inlineDisable({ clause: FIRST, file: ALPHA, line: 1, text: `// ${NOCHECK}` }),
          inlineDisable({ clause: FIRST, file: ALPHA, line: 2, text: `// ${EXPECTATION} legacy` }),
          inlineDisable({ clause: FIRST, file: ALPHA, line: 4, text: `// ${IGNORE} reason (#42)` }),
          inlineDisable({ clause: FIRST, file: BETA, line: 1, text: `// ${NOCHECK}` }),
          inlineDisable({ clause: FIRST, file: BETA, line: 2, text: `// ${EXPECTATION} legacy` }),
          inlineDisable({ clause: FIRST, file: BETA, line: 4, text: `// ${IGNORE} reason (#42)` }),
        ],
        measured: [
          { clause: FIRST, file: ALPHA },
          { clause: FIRST, file: BETA },
        ],
      },
    });
  });

  it("reports only the directives each clause declares, and none for a clause that declares none", async () => {
    expect(
      await directiveRun({
        clauses: [escapingClause({ address: FIRST, escapingDirectives: [IGNORE] }), clauseFor({ address: SECOND, module: "shared.ts" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          inlineDisable({ clause: FIRST, file: ALPHA, line: 4, text: `// ${IGNORE} reason (#42)` }),
          inlineDisable({ clause: FIRST, file: BETA, line: 4, text: `// ${IGNORE} reason (#42)` }),
        ],
        measured: BOTH_CLAUSES_ON_ALPHA_AND_BETA,
      },
    });
  });

});

describe("createWalkerRunner run, type directives several clauses or conform meet", () => {
  it("reports one inline disable per declaring clause, in clause order, for a directive two clauses declare", async () => {
    expect(
      await directiveRun({
        clauses: [
          escapingClause({ address: FIRST, escapingDirectives: [EXPECTATION] }),
          escapingClause({ address: SECOND, escapingDirectives: [EXPECTATION] }),
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          inlineDisable({ clause: FIRST, file: ALPHA, line: 2, text: `// ${EXPECTATION} legacy` }),
          inlineDisable({ clause: SECOND, file: ALPHA, line: 2, text: `// ${EXPECTATION} legacy` }),
          inlineDisable({ clause: FIRST, file: BETA, line: 2, text: `// ${EXPECTATION} legacy` }),
          inlineDisable({ clause: SECOND, file: BETA, line: 2, text: `// ${EXPECTATION} legacy` }),
        ],
        measured: BOTH_CLAUSES_ON_ALPHA_AND_BETA,
      },
    });
  });

  it("gives conform's verdict no line for a directive", async () => {
    const runner = runnerWith({
      fileText: fileTextOf({ read: vi.fn() }),
      modules: modulesOf({ check: pieceReadingAlphaThenBeta() }),
    });

    expect(
      await runner.conform({
        clause: escapingClause({ address: FIRST, escapingDirectives: [IGNORE] }),
        cases: [{ name: "a directive", fileName: ALPHA, source: DIRECTIVE_SOURCE, expectedLines: [] }],
      }),
    ).toEqual({ outcome: "ok", value: [{ caseName: "a directive", flaggedLines: [] }] });
  });

  it("is piece-invalid when a clause declares an escape the compiler does not honour", async () => {
    expect(await directiveRun({ clauses: [escapingClause({ address: FIRST, escapingDirectives: ["@ts-check"] })] })).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });
});

describe("createWalkerRunner conform", () => {
  it("returns each case's flagged lines in case order from its own source, reading no file", async () => {
    const read = vi.fn<FileTextPort["read"]>();
    const runner = runnerWith({ fileText: fileTextOf({ read }), modules: modulesOf({ check: firstClauseLetKeywordPiece }) });

    expect(
      await runner.conform({
        clause: FIRST_CLAUSE,
        cases: [
          { name: "let on line two", fileName: ALPHA, source: SOURCE, expectedLines: [1, 2] },
          { name: "let on line one", fileName: ALPHA, source: "let b = 2;", expectedLines: [1] },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { caseName: "let on line two", flaggedLines: [1, 2] },
        { caseName: "let on line one", flaggedLines: [1] },
      ],
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("prepares each case over a disk holding only that case's file under the case root", async () => {
    const prepare = skippingPrepare();

    await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: { prepare } }) }).conform({
      clause: FIRST_CLAUSE,
      cases: [{ name: "config", fileName: CONFIG, source: "{}", expectedLines: [] }],
    });

    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ repository: expect.objectContaining({ disk: expect.objectContaining({ root: CASE_ROOT }) }) }),
    );
  });

  it("prepares each case over a repository holding only that case's file", async () => {
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: {
        prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
        finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] }),
      },
    });

    await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: { prepare } }) }).conform({
      clause: FIRST_CLAUSE,
      cases: [{ name: "config", fileName: CONFIG, source: "{}", expectedLines: [] }],
    });

    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ clauses: [FIRST_CLAUSE], repository: expect.objectContaining({ files: [CONFIG] }) }),
    );
  });
});
