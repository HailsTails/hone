import { anyBearingOf, assertionOf, castSnippetAt } from "../../runner/pieces/cast-shape.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (sourceEligibility({ file }) === "excluded") {
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
                  if (anyBearingOf({ typeNode: assertion.type, syntaxApi }) === "any-free") return;
                  const position = node.getStart(sourceFile);
                  const snippet = castSnippetAt({ sourceFile, position });
                  const anchor = anchorAt({ position });
                  hits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
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
