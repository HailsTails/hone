import { folderScope } from "../../runner/pieces/source-scope.ts";
import { sourceSnippetAt } from "../../runner/pieces/source-snippet.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  if (folderScope({ file: request.file }) === "generated") return "skipped";
  return request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx")
    ? "eligible"
    : "skipped";
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file }) === "skipped") {
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
                  if (!syntaxApi.isCallExpression(node)) return;
                  const callee = node.expression;
                  if (!syntaxApi.isPropertyAccessExpression(callee)) return;
                  const isImplementationArgument =
                    callee.name.text === "fn" &&
                    syntaxApi.isIdentifier(callee.expression) &&
                    callee.expression.text === "vi" &&
                    node.arguments.length > 0;
                  if (!isImplementationArgument && callee.name.text !== "mockImplementation")
                    return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = sourceSnippetAt({ source: sourceFile.text, position });
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
