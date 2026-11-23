import type { SyntaxApi, SyntaxNode } from "../toolchain/typescript-parse.ts";

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const bindingNames = ({ syntaxApi, node }: SyntaxRequest): readonly string[] => {
  if (syntaxApi.isIdentifier(node)) return [node.text];
  if (!syntaxApi.isObjectBindingPattern(node) && !syntaxApi.isArrayBindingPattern(node)) return [];
  return node.elements.flatMap((element) =>
    syntaxApi.isBindingElement(element) ? bindingNames({ syntaxApi, node: element.name }) : [],
  );
};

export const parameterBinding = (
  request: SyntaxRequest & { readonly name: string },
): "local" | "unbound" => {
  const { syntaxApi, node, name } = request;
  if (syntaxApi.isSourceFile(node)) return "unbound";
  if (
    syntaxApi.isFunctionLike(node) &&
    node.parameters.some((parameter) =>
      bindingNames({ syntaxApi, node: parameter.name }).includes(name),
    )
  )
    return "local";
  return parameterBinding({ syntaxApi, node: node.parent, name });
};
