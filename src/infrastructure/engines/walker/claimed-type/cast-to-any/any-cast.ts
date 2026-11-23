import { anyBearingOf, assertionOf, castSnippetAt } from "../../runner/pieces/cast-shape.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
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
  }),
};
