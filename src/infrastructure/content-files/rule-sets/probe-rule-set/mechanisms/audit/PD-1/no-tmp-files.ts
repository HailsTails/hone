import type { WalkerPiece } from "../../../../../../engines/walker/runner/pieces/walker-piece.ts";

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => ({
        outcome: "ok",
        value: {
          kind: "complete",
          hits: file.endsWith(".tmp.ts")
            ? bindings.map((binding) => ({
                check: binding.address,
                anchor: { line: 1, column: 0 },
                snippet: file,
              }))
            : [],
        },
      }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
