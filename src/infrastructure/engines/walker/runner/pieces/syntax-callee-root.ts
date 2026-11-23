import type { Identifier, SyntaxApi, SyntaxNode } from "../toolchain/typescript-parse.ts";
import { withoutParentheses } from "./syntax-parentheses.ts";

export const calleeRootOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): Identifier | undefined => {
  const { syntaxApi } = request;
  const node = withoutParentheses(request);
  if (syntaxApi.isIdentifier(node)) return node;
  if (syntaxApi.isTaggedTemplateExpression(node))
    return calleeRootOf({ syntaxApi, node: node.tag });
  if (
    syntaxApi.isPropertyAccessExpression(node) ||
    syntaxApi.isElementAccessExpression(node) ||
    syntaxApi.isCallExpression(node) ||
    syntaxApi.isNonNullExpression(node)
  )
    return calleeRootOf({ syntaxApi, node: node.expression });
  return undefined;
};
