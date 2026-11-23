import type { PieceHit, WalkerPiece } from "@hailstails/hone/walker";

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
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
                hits.push(...bindings.map((binding) => ({ check: binding.address, anchor: anchorAt({ position }), snippet: position })));
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
