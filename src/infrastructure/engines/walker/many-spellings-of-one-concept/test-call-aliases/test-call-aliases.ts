import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const VITEST_TEST_NAMES = new Set(["test", "it", "suite", "describe"]);

const testAliasRootOf = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
  if (syntaxApi.isTaggedTemplateExpression(node))
    return testAliasRootOf({ syntaxApi, node: node.tag });
  if (
    syntaxApi.isPropertyAccessExpression(node) ||
    syntaxApi.isElementAccessExpression(node) ||
    syntaxApi.isParenthesizedExpression(node) ||
    syntaxApi.isNonNullExpression(node)
  )
    return testAliasRootOf({ syntaxApi, node: node.expression });
  return syntaxApi.isIdentifier(node) && (node.text === "test" || node.text === "suite")
    ? node
    : undefined;
};

const testImportOrigin = ({ syntaxApi, node }: SyntaxRequest): "vitest" | "other" => {
  if (!syntaxApi.isImportSpecifier(node) || node.isTypeOnly) return "other";
  const clause = node.parent.parent;
  const declaration = clause.parent;
  return syntaxApi.isImportDeclaration(declaration) &&
    syntaxApi.isStringLiteral(declaration.moduleSpecifier) &&
    declaration.moduleSpecifier.text === "vitest" &&
    !clause.isTypeOnly &&
    VITEST_TEST_NAMES.has((node.propertyName ?? node.name).text)
    ? "vitest"
    : "other";
};

const checkerIn = ({
  syntaxApi,
  sourceFile,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
}) =>
  syntaxApi
    .createProgram(
      [sourceFile.fileName],
      { noLib: true, noResolve: true },
      {
        getSourceFile: (file) => (file === sourceFile.fileName ? sourceFile : undefined),
        readFile: (file) => (file === sourceFile.fileName ? sourceFile.text : undefined),
        fileExists: (file) => file === sourceFile.fileName,
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => "/",
        getDefaultLibFileName: () => "lib.d.ts",
        getNewLine: () => "\n",
        useCaseSensitiveFileNames: () => true,
        writeFile: () => undefined,
      },
    )
    .getTypeChecker();

const testAliasSites = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
  readonly candidates: readonly SyntaxNode[];
}): readonly SyntaxNode[] => {
  if (request.candidates.length === 0) return [];
  const checker = checkerIn(request);
  return request.candidates.filter((node) => {
    const symbol = checker.getSymbolAtLocation(node);
    return (
      symbol === undefined ||
      (symbol.declarations ?? []).some(
        (declaration) =>
          testImportOrigin({ syntaxApi: request.syntaxApi, node: declaration }) === "vitest",
      )
    );
  });
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) =>
        testFileEligibility({ file }) === "skipped"
          ? { outcome: "ok", value: { kind: "skipped" } }
          : {
              outcome: "ok",
              value: {
                kind: "syntax",
                begin: ({ sourceFile, anchorAt }) => {
                  const candidates: SyntaxNode[] = [];
                  return {
                    enter: ({ node }) => {
                      if (!syntaxApi.isCallExpression(node)) return;
                      const root = testAliasRootOf({ syntaxApi, node: node.expression });
                      if (root !== undefined) candidates.push(root);
                    },
                    finish: () =>
                      testAliasSites({ syntaxApi, sourceFile, candidates }).flatMap((node) =>
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
