import { typeScriptSourceEligibility } from "../../runner/pieces/source-scope.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";
import { withoutParentheses } from "../../runner/pieces/syntax-parentheses.ts";

const immediateBuilderOf = ({ syntaxApi, node }: Pick<SyntaxVisit, "syntaxApi" | "node">) => {
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = withoutParentheses({ syntaxApi, node: node.expression });
  if (!syntaxApi.isCallExpression(callee)) return undefined;
  return callee.arguments.some((argument) =>
    syntaxApi.isObjectLiteralExpression(withoutParentheses({ syntaxApi, node: argument })),
  )
    ? callee
    : undefined;
};

export const check = syntaxNodeCheck({
  eligibility: typeScriptSourceEligibility,
  found: (visit) => {
    const builder = immediateBuilderOf(visit);
    if (builder === undefined) return undefined;
    if (immediateBuilderOf({ syntaxApi: visit.syntaxApi, node: builder }) !== undefined)
      return undefined;
    return { at: builder, snippet: builder.expression.getText(visit.sourceFile) };
  },
});
