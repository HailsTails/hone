import type { EslintPieceSettings, Examples } from "@hailstails/hone/rule-set";
import { checkConformanceOf, checkUnderTestOf, type TeamRuleSetUnderTest } from "@hailstails/hone/testing";
import { folderScope } from "@hailstails/hone/walker";

import consolePiece from "../engines/eslint/direct-console/console-calls/piece.json" with { type: "json" };
import consoleExamples from "../engines/eslint/direct-console/console-calls/console-calls.examples.json" with { type: "json" };
import scratchPiece from "../engines/walker/scratch-file/scratch-files/piece.json" with { type: "json" };
import scratchExamples from "../engines/walker/scratch-file/scratch-files/scratch-files.examples.json" with { type: "json" };

declare global {
  interface ImportMeta {
    readonly dirname: string;
  }
}

const SCRATCH_PIECE_ROOT = import.meta.dirname.replace(
  /([\\/])proof$/,
  "$1engines$1walker$1scratch-file$1scratch-files",
);

const ACME: TeamRuleSetUnderTest = { name: "acme", root: "tools/disciplines/acme" };

export const typedExamples: readonly Examples[] = [consoleExamples, scratchExamples];
export const typedConsoleSettings: EslintPieceSettings = consolePiece.settings;

const provedEqual = (request: { readonly proof: string; readonly actual: unknown; readonly expected: unknown }): void => {
  if (JSON.stringify(request.actual) !== JSON.stringify(request.expected)) {
    throw new Error(`${request.proof}: expected ${JSON.stringify(request.expected)}, but got ${JSON.stringify(request.actual)}`);
  }
};

provedEqual({ proof: "a dependency folder is generated", actual: folderScope({ file: "node_modules/acme/index.js" }), expected: "generated" });
provedEqual({ proof: "a source file is authored", actual: folderScope({ file: "src/kept.ts" }), expected: "authored" });

provedEqual({
  proof: "acme's scratch-files examples are read from its own rule set, each at its edition",
  actual: checkUnderTestOf({ ruleSet: ACME, check: "scratch-file#scratch-files", engine: "walker" }),
  expected: {
    outcome: "ok",
    value: {
      ruleSet: ACME,
      check: "scratch-file#scratch-files",
      engine: "walker",
      binding: {
        address: "scratch-file#scratch-files",
        ruleSet: { name: "acme" },
        engine: "walker",
        anchor: { kind: "file" },
        pieceRoot: SCRATCH_PIECE_ROOT,
        settings: scratchPiece.settings,
        forms: {},
        checkSettings: {},
        edition: "1",
      },
      examples: [
        { name: "scratch file", file: "src/draft.scratch.ts", source: "export const draft = 1;\n", edition: "1" },
        { name: "draft file", file: "src/notes.draft.ts", source: "export const notes = 1;\n", edition: "2" },
        { name: "ordinary file", file: "src/kept.ts", source: "export const kept = 1;\n", edition: "1" },
        { name: "draft file before edition 2", file: "src/notes.draft.ts", source: "export const notes = 1;\n", edition: "1" },
      ],
    },
  },
});

provedEqual({
  proof: "acme's walker piece meets its own examples",
  actual: await checkConformanceOf({ ruleSet: ACME, check: "scratch-file#scratch-files", engine: "walker" }),
  expected: { outcome: "ok", value: [] },
});

provedEqual({
  proof: "acme's ESLint piece meets its own examples",
  actual: await checkConformanceOf({ ruleSet: ACME, check: "direct-console#console-calls", engine: "eslint" }),
  expected: { outcome: "ok", value: [] },
});
