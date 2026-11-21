import type { PieceHit, WalkerPiece } from "@hailstails/hone/audit";

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: () => ({
        outcome: "ok",
        value: {
          kind: "syntax",
          begin: ({ sourceFile, anchorAt }) => {
            const hits: PieceHit[] = [];
            return {
              enter: ({ node }) => {
                const position = node.getStart(sourceFile);
                hits.push(...clauses.map((clause) => ({ clause: clause.address, anchor: anchorAt({ position }), snippet: position })));
              },
              finish: () => hits,
            };
          },
        },
      }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
