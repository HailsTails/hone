import { typeScriptSourceKindOf } from "./source-scope.ts";
import { sourceSnippetOf } from "./source-snippet.ts";
import type { PieceHit, WalkerPiece } from "./walker-piece.ts";

export const throwStatementCheck = (scope: "production" | "test"): WalkerPiece => ({
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (typeScriptSourceKindOf({ file }) !== scope) {
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
                  const snippet = sourceSnippetOf(node.getText(sourceFile));
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
