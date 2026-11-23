import { typeScriptSourceEligibility } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (typeScriptSourceEligibility({ file }) === "skipped")
          return { outcome: "ok", value: { kind: "skipped" } };
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  if (!syntaxApi.isDebuggerStatement(node)) return;
                  const anchor = anchorAt({ position: node.getStart(sourceFile) });
                  hits.push(
                    ...bindings.map(({ address }) => ({
                      check: address,
                      anchor,
                      snippet: "debugger",
                    })),
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
};
