import type { SyntaxApi, SyntaxNode } from "../toolchain/typescript-parse.ts";

type DeclarationRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const valueImportFromVitest = ({ syntaxApi, node }: DeclarationRequest): boolean => {
  if (syntaxApi.isImportDeclaration(node)) {
    return (
      syntaxApi.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "vitest" &&
      node.importClause?.isTypeOnly !== true
    );
  }
  if (node.parent === undefined || syntaxApi.isSourceFile(node)) return false;
  return valueImportFromVitest({ syntaxApi, node: node.parent });
};

export const vitestImportedNameOf = (request: DeclarationRequest): string | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isImportSpecifier(node))
    return !node.isTypeOnly && valueImportFromVitest(request)
      ? (node.propertyName ?? node.name).text
      : undefined;
  if (syntaxApi.isNamespaceImport(node)) return valueImportFromVitest(request) ? "*" : undefined;
  if (syntaxApi.isImportClause(node))
    return node.name !== undefined && valueImportFromVitest(request) ? "default" : undefined;
  return undefined;
};
