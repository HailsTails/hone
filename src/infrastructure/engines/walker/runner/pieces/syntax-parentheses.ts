import type { SyntaxApi, SyntaxNode } from "../toolchain/typescript-parse.ts";

type ParenthesesRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

export const withoutParentheses = ({ syntaxApi, node }: ParenthesesRequest): SyntaxNode =>
  syntaxApi.isParenthesizedExpression(node)
    ? withoutParentheses({ syntaxApi, node: node.expression })
    : node;
