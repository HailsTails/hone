import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;
const NON_PRODUCTION_FILE = /\.(?:d|test|spec)\.(?:ts|tsx|mts|cts)$/;

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (
          !TYPESCRIPT_FILE.test(file) ||
          NON_PRODUCTION_FILE.test(file) ||
          folderScope({ file }) === "generated"
        ) {
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
                  const snippet = node.getText(sourceFile).replace(/\r?\n/g, " ");
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
};
