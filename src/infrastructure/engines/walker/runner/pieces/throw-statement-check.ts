import { folderScope } from "./source-scope.ts";
import type { PieceHit, WalkerPiece } from "./walker-piece.ts";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mts|cts)$/;
const DECLARATION_FILE = /\.d\.(?:ts|tsx|mts|cts)$/;
const SNIPPET_LENGTH = 80;

export const throwSourceScopeOf = (file: string): "production" | "test" | "skipped" => {
  if (
    !TYPESCRIPT_FILE.test(file) ||
    DECLARATION_FILE.test(file) ||
    folderScope({ file }) === "generated"
  )
    return "skipped";
  return TEST_FILE.test(file) ? "test" : "production";
};

export const throwSnippetOf = (source: string): string => {
  const snippet = source.replace(/\r?\n[ \t]*/g, " ");
  return snippet.length > SNIPPET_LENGTH ? `${snippet.slice(0, SNIPPET_LENGTH)}…` : snippet;
};

export const throwStatementCheck = (scope: "production" | "test"): WalkerPiece => ({
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (throwSourceScopeOf(file) !== scope) {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  if (!syntaxApi.isThrowStatement(node)) return;
                  const anchor = anchorAt({ position: node.getStart(sourceFile) });
                  const snippet = throwSnippetOf(node.getText(sourceFile));
                  hits.push(
                    ...bindings.map(({ address }) => ({ check: address, anchor, snippet })),
                  );
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
});
