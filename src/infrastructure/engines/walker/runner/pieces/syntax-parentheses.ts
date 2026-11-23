import type { SyntaxApi, SyntaxNode } from "../toolchain/typescript-parse.ts";

type ParenthesesRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

export const withoutParentheses = ({ syntaxApi, node }: ParenthesesRequest): SyntaxNode =>
  syntaxApi.isParenthesizedExpression(node)
    ? withoutParentheses({ syntaxApi, node: node.expression })
    : node;

export const outermostParenthesesOf = ({ syntaxApi, node }: ParenthesesRequest): SyntaxNode =>
  node.parent !== undefined && syntaxApi.isParenthesizedExpression(node.parent)
    ? outermostParenthesesOf({ syntaxApi, node: node.parent })
    : node;
