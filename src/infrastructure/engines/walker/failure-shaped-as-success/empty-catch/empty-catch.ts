import { typeScriptSourceEligibility } from "../../runner/pieces/source-scope.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";
import type { SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

const emptyCallback = (
  request: Pick<SyntaxVisit, "syntaxApi"> & { readonly argument: SyntaxNode | undefined },
): boolean => {
  const { syntaxApi, argument } = request;
  return (
    argument !== undefined &&
    (syntaxApi.isArrowFunction(argument) || syntaxApi.isFunctionExpression(argument)) &&
    syntaxApi.isBlock(argument.body) &&
    argument.body.statements.length === 0
  );
};

const promiseHandlerAt = (request: Pick<SyntaxVisit, "syntaxApi" | "node">) => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  const member = syntaxApi.isPropertyAccessExpression(callee)
    ? callee.name
    : syntaxApi.isElementAccessExpression(callee) &&
        syntaxApi.isStringLiteralLike(callee.argumentExpression)
      ? callee.argumentExpression
      : undefined;
  if (member?.text === "catch" && emptyCallback({ syntaxApi, argument: node.arguments[0] }))
    return { at: member, snippet: "catch" };
  if (member?.text === "then" && emptyCallback({ syntaxApi, argument: node.arguments[1] }))
    return { at: member, snippet: "then" };
  return undefined;
};

export const check = syntaxNodeCheck({
  eligibility: typeScriptSourceEligibility,
  found: ({ syntaxApi, node }) =>
    syntaxApi.isCatchClause(node) && node.block.statements.length === 0
      ? { at: node, snippet: "catch" }
      : promiseHandlerAt({ syntaxApi, node }),
});
