import type {
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
  TypeChecker,
} from "../toolchain/typescript-parse.ts";

export const sourceBindingsOf = ({
  syntaxApi,
  sourceFile,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
}): TypeChecker =>
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

const ambientDeclaration = ({
  syntaxApi,
  node,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): boolean => {
  if (syntaxApi.isSourceFile(node)) return node.isDeclarationFile;
  if (syntaxApi.isInterfaceDeclaration(node) || syntaxApi.isTypeAliasDeclaration(node)) return true;
  if (
    (syntaxApi.isImportSpecifier(node) ||
      syntaxApi.isImportClause(node) ||
      syntaxApi.isImportEqualsDeclaration(node)) &&
    node.isTypeOnly
  )
    return true;
  if (
    syntaxApi.canHaveModifiers(node) &&
    syntaxApi
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === syntaxApi.SyntaxKind.DeclareKeyword)
  )
    return true;
  return node.parent !== undefined && ambientDeclaration({ syntaxApi, node: node.parent });
};

export const runtimeDeclarationsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly declarations: readonly SyntaxNode[];
}): readonly SyntaxNode[] =>
  request.declarations.filter(
    (node) => !ambientDeclaration({ syntaxApi: request.syntaxApi, node }),
  );

export const sourceValueDeclarationsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly bindings: TypeChecker;
  readonly node: SyntaxNode;
}): readonly SyntaxNode[] => {
  const { syntaxApi, bindings, node } = request;
  const parent = node.parent;
  const symbol =
    parent !== undefined && syntaxApi.isShorthandPropertyAssignment(parent) && parent.name === node
      ? bindings.getShorthandAssignmentValueSymbol(parent)
      : bindings.getSymbolAtLocation(node);
  return runtimeDeclarationsOf({ syntaxApi, declarations: symbol?.declarations ?? [] });
};

export const sourceValueLookupOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
}): ((node: SyntaxNode) => readonly SyntaxNode[]) => {
  let bindings: TypeChecker | undefined;
  return (node) => {
    bindings ??= sourceBindingsOf(request);
    return sourceValueDeclarationsOf({ syntaxApi: request.syntaxApi, bindings, node });
  };
};
