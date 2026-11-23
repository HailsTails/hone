import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../toolchain/typescript-parse.ts";

export const sourceBindingsOf = ({
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

export const sourceValueDeclarationsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly bindings: ReturnType<typeof sourceBindingsOf>;
  readonly node: SyntaxNode;
}) => {
  const { syntaxApi, bindings, node } = request;
  const parent = node.parent;
  const symbol =
    parent !== undefined && syntaxApi.isShorthandPropertyAssignment(parent) && parent.name === node
      ? bindings.getShorthandAssignmentValueSymbol(parent)
      : bindings.getSymbolAtLocation(node);
  return (
    symbol?.declarations?.filter(
      (declaration) => declaration.getSourceFile() === node.getSourceFile(),
    ) ?? []
  );
};
