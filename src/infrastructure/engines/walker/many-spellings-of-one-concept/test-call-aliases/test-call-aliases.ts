import { sourceBindingsOf } from "../../runner/pieces/source-bindings.ts";
import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { calleeRootOf } from "../../runner/pieces/syntax-callee-root.ts";
import { vitestImportedNameOf } from "../../runner/pieces/vitest-import.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";

const VITEST_TEST_NAMES = new Set(["test", "it", "suite", "describe"]);

const testAliasSites = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
  readonly candidates: readonly SyntaxNode[];
}): readonly SyntaxNode[] => {
  if (request.candidates.length === 0) return [];
  const checker = sourceBindingsOf(request);
  return request.candidates.filter((node) => {
    const symbol = checker.getSymbolAtLocation(node);
    return (
      symbol === undefined ||
      (symbol.declarations ?? []).some((declaration) => {
        const importedName = vitestImportedNameOf({
          syntaxApi: request.syntaxApi,
          node: declaration,
        });
        return importedName !== undefined && VITEST_TEST_NAMES.has(importedName);
      })
    );
  });
};

export const check: WalkerPiece = {
  prepare: ({ bindings, repository, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) =>
        testFileEligibility({ file, testFiles: repository.testFiles }) === "skipped"
          ? { outcome: "ok", value: { kind: "skipped" } }
          : {
              outcome: "ok",
              value: {
                kind: "syntax",
                begin: ({ sourceFile, anchorAt }) => {
                  const candidates = new Set<SyntaxNode>();
                  return {
                    enter: ({ node }) => {
                      if (!syntaxApi.isCallExpression(node)) return;
                      const root = calleeRootOf({ syntaxApi, node: node.expression });
                      if (root?.text === "test" || root?.text === "suite") candidates.add(root);
                    },
                    finish: () =>
                      testAliasSites({
                        syntaxApi,
                        sourceFile,
                        candidates: [...candidates],
                      }).flatMap((node) =>
                        bindings.map(({ address }) => ({
                          check: address,
                          anchor: anchorAt({ position: node.getStart(sourceFile) }),
                          snippet: node.getText(sourceFile),
                        })),
                      ),
                  };
                },
              },
            },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
