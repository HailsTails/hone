import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { sourceSnippetAt } from "../../runner/pieces/source-snippet.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

export const check: WalkerPiece = {
  prepare: ({ bindings, repository, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file, testFiles: repository.testFiles }) === "skipped") {
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
