import { siteRule, type ThrowSite } from "../../runner/pieces/rule-sites.ts";

type ThrownExpression = ThrowSite["argument"];

type ThrownDisposition = "non-error" | "possibly-error";

const NON_ERROR_EXPRESSIONS: ReadonlySet<string> = new Set([
  "Literal",
  "ObjectExpression",
  "BinaryExpression",
  "TemplateLiteral",
  "TaggedTemplateExpression",
]);

const eitherNonError = (request: {
  readonly first: ThrownExpression | undefined;
  readonly second: ThrownExpression | undefined;
}): ThrownDisposition =>
  thrownDisposition({ expression: request.first }) === "non-error" ||
  thrownDisposition({ expression: request.second }) === "non-error"
    ? "non-error"
    : "possibly-error";

const compositeDisposition = (request: {
  readonly expression: ThrownExpression;
}): ThrownDisposition => {
  const expression = request.expression;
  if (expression.type === "LogicalExpression") {
    return eitherNonError({ first: expression.left, second: expression.right });
  }
  if (expression.type === "ConditionalExpression") {
    return eitherNonError({ first: expression.consequent, second: expression.alternate });
  }
  if (expression.type === "AssignmentExpression") {
    return thrownDisposition({ expression: expression.right });
  }
  return expression.type === "SequenceExpression"
    ? thrownDisposition({ expression: expression.expressions.at(-1) })
    : "possibly-error";
};

const thrownDisposition = (request: {
  readonly expression: ThrownExpression | undefined;
}): ThrownDisposition => {
  if (request.expression === undefined) {
    return "possibly-error";
  }
  if (NON_ERROR_EXPRESSIONS.has(request.expression.type)) {
    return "non-error";
  }
  if (request.expression.type === "Identifier") {
    return request.expression.name === "undefined" ? "non-error" : "possibly-error";
  }
  return compositeDisposition({ expression: request.expression });
};

const throwOnlyError = siteRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow throwing values that cannot be Error objects (CD-10)" },
    schema: [],
    messages: {
      throwOnlyError: "CD-10: throw an Error, not a literal, object, template or undefined.",
    },
  },
  observe: (context) => ({
    throws: (node) => {
      if (thrownDisposition({ expression: node.argument }) === "possibly-error") {
        return;
      }
      context.report({ node, messageId: "throwOnlyError" });
    },
  }),
});

export default {
  meta: { name: "hone-cd10", version: "0.0.0-local" },
  rules: { "throw-only-error": throwOnlyError },
};
