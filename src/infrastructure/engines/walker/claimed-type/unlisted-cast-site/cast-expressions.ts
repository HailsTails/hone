import {
  anyBearingOf,
  assertionOf,
  type CastShape,
  castShapeOf,
  castSnippetAt,
} from "../../runner/pieces/cast-shape.ts";
import { checkedSourceOf } from "../../runner/pieces/checked-source.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const THROUGH_UNKNOWN_MESSAGE = "cast through unknown — check the value's shape at runtime instead";

const reportedSnippet = (request: {
  readonly shape: CastShape;
  readonly snippet: string;
}): string =>
  request.shape === "through-unknown"
    ? `${THROUGH_UNKNOWN_MESSAGE}: ${request.snippet}`
    : request.snippet;

export const check: WalkerPiece = {
  prepare: ({ bindings, repository, syntaxApi }) => {
    const checkedSource = checkedSourceOf({ syntaxApi, disk: repository.disk });
    return {
      outcome: "ok",
      value: {
        prepareFile: (walkerFile) => {
          const checking = checkedSource(walkerFile);
          if (checking.outcome === "failed") return checking;
          if (checking.value === "unchecked") {
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
                    const assertion = assertionOf({ node, syntaxApi });
                    if (assertion === undefined) return;
                    if (anyBearingOf({ typeNode: assertion.type, syntaxApi }) === "any-bearing")
                      return;
                    const shape = castShapeOf({ assertion, syntaxApi });
                    if (shape === "const-assertion") return;
                    const position = node.getStart(sourceFile, assertion.form === "jsdoc");
                    const snippet = reportedSnippet({
                      shape,
                      snippet: castSnippetAt({ sourceFile, position }),
                    });
                    const anchor = anchorAt({ position });
                    hits.push(
                      ...bindings.map((binding) => ({ check: binding.address, anchor, snippet })),
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
    };
  },
};
