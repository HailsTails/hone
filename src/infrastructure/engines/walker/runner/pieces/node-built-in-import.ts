import type { SyntaxApi, SyntaxNode } from "../toolchain/typescript-parse.ts";

export type NodeBuiltIn = "console" | "crypto" | "process";

export type BuiltInImport =
  | { readonly kind: "module" }
  | { readonly kind: "namespace" }
  | { readonly kind: "named"; readonly name: string };

type DeclarationsOf = (node: SyntaxNode) => readonly SyntaxNode[];

type BoundImport = { readonly specifier: SyntaxNode | undefined; readonly shape: BuiltInImport };

const WHOLE_MODULE: BuiltInImport = { kind: "module" };
const NAMESPACE: BuiltInImport = { kind: "namespace" };

const requiredSpecifierOf = ({
  syntaxApi,
  initializer,
  declarationsOf,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly initializer: SyntaxNode | undefined;
  readonly declarationsOf: DeclarationsOf;
}): SyntaxNode | undefined => {
  if (initializer === undefined || !syntaxApi.isCallExpression(initializer)) return undefined;
  const { expression, arguments: callArguments } = initializer;
  return syntaxApi.isIdentifier(expression) &&
    expression.text === "require" &&
    declarationsOf(expression).length === 0
    ? callArguments[0]
    : undefined;
};

const boundImportOf = ({
  syntaxApi,
  declaration,
  declarationsOf,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly declaration: SyntaxNode;
  readonly declarationsOf: DeclarationsOf;
}): BoundImport | undefined => {
  if (syntaxApi.isVariableDeclaration(declaration))
    return {
      specifier: requiredSpecifierOf({
        syntaxApi,
        initializer: declaration.initializer,
        declarationsOf,
      }),
      shape: WHOLE_MODULE,
    };
  if (syntaxApi.isImportEqualsDeclaration(declaration))
    return syntaxApi.isExternalModuleReference(declaration.moduleReference)
      ? { specifier: declaration.moduleReference.expression, shape: WHOLE_MODULE }
      : undefined;
  if (syntaxApi.isImportClause(declaration))
    return { specifier: declaration.parent.moduleSpecifier, shape: WHOLE_MODULE };
  if (syntaxApi.isNamespaceImport(declaration))
    return { specifier: declaration.parent.parent.moduleSpecifier, shape: NAMESPACE };
  if (!syntaxApi.isImportSpecifier(declaration)) return undefined;
  const name = (declaration.propertyName ?? declaration.name).text;
  return {
    specifier: declaration.parent.parent.parent.moduleSpecifier,
    shape: name === "default" ? WHOLE_MODULE : { kind: "named", name },
  };
};

export const builtInImportOf = ({
  syntaxApi,
  identifier,
  declarationsOf,
  builtIn,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly identifier: SyntaxNode;
  readonly declarationsOf: DeclarationsOf;
  readonly builtIn: NodeBuiltIn;
}): BuiltInImport | undefined =>
  declarationsOf(identifier)
    .map((declaration) => boundImportOf({ syntaxApi, declaration, declarationsOf }))
    .find(
      (bound) =>
        bound?.specifier !== undefined &&
        syntaxApi.isStringLiteral(bound.specifier) &&
        (bound.specifier.text === builtIn || bound.specifier.text === `node:${builtIn}`),
    )?.shape;
