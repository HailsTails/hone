import type { TypescriptEslintRule } from "../../runner/toolchain/eslint-toolchain.ts";

type RuleContext = Parameters<TypescriptEslintRule["create"]>[0];
type UnreadRuleContext = Omit<RuleContext, "report"> & {
  readonly report: (
    descriptor: Parameters<RuleContext["report"]>[0] & { readonly messageId: "unread" },
  ) => void;
};
type SourceCode = RuleContext["sourceCode"];
type Listener = ReturnType<TypescriptEslintRule["create"]>;
type FunctionSite = Parameters<
  NonNullable<Listener["FunctionDeclaration" | "FunctionExpression" | "ArrowFunctionExpression"]>
>[0];

type Variable = ReturnType<SourceCode["getDeclaredVariables"]>[number];
type Reference = Variable["references"][number];
type Identifier = Variable["identifiers"][number];

const valueRead = (request: {
  readonly reference: Reference;
  readonly sourceCode: SourceCode;
}): boolean => {
  const { reference, sourceCode } = request;
  if (!reference.isRead() || reference.isValueReference === false) return false;
  const { identifier } = reference;
  if (identifier.type !== "Identifier") return true;
  const { parent } = identifier;
  if (
    (parent.type === "UpdateExpression" ||
      (parent.type === "AssignmentExpression" && parent.left === identifier)) &&
    parent.parent.type === "ExpressionStatement"
  )
    return false;
  return !sourceCode
    .getAncestors(identifier)
    .some(({ type }) => type === "TSTypeQuery" || type === "TSTypePredicate");
};

const bindsWithin = (request: {
  readonly identifier: Identifier;
  readonly parameter: FunctionSite["params"][number];
}): boolean => {
  const identifier = request.identifier.range;
  const parameter = request.parameter.range;
  return identifier[0] >= parameter[0] && identifier[1] <= parameter[1];
};

const excludedFromRest = (identifier: Identifier): boolean => {
  const parent = identifier.parent;
  const entry =
    parent.type === "AssignmentPattern" && parent.left === identifier ? parent : identifier;
  const containing = entry.parent;
  if (containing.type === "Property" && containing.value === entry) {
    const pattern = containing.parent;
    return (
      pattern.type === "ObjectPattern" &&
      pattern.properties.some((property) => property.type === "RestElement")
    );
  }
  return (
    containing.type === "ArrayPattern" &&
    containing.elements.some((element) => element?.type === "RestElement")
  );
};

const bindingKindOf = (parameter: FunctionSite["params"][number]): "destructured" | "slot" => {
  const binding = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
  return binding.type === "ArrayPattern" || binding.type === "ObjectPattern"
    ? "destructured"
    : "slot";
};

const parameterBindingsOf = (request: {
  readonly site: FunctionSite;
  readonly sourceCode: SourceCode;
}) =>
  request.sourceCode.getDeclaredVariables(request.site).flatMap((variable) => {
    if (!variable.defs.some(({ type }) => type === "Parameter")) return [];
    const [identifier] = variable.identifiers;
    if (identifier === undefined || identifier.name === "this" || excludedFromRest(identifier))
      return [];
    const index = request.site.params.findIndex((parameter) =>
      bindsWithin({ identifier, parameter }),
    );
    const parameter = request.site.params[index];
    return parameter === undefined || parameter.type === "TSParameterProperty"
      ? []
      : [
          {
            index,
            kind: bindingKindOf(parameter),
            identifier,
            read: variable.references.some((reference) =>
              valueRead({ reference, sourceCode: request.sourceCode }),
            ),
          },
        ];
  });

const observeParameters = (request: {
  readonly context: UnreadRuleContext;
  readonly site: FunctionSite;
}): void => {
  const { context, site } = request;
  const parent = site.parent;
  if ((parent.type === "MethodDefinition" || parent.type === "Property") && parent.kind === "set")
    return;
  if (
    site.type !== "ArrowFunctionExpression" &&
    context.sourceCode
      .getScope(site)
      .variables.some(
        (variable) =>
          variable.name === "arguments" &&
          variable.defs.length === 0 &&
          variable.references.some((reference) => reference.isRead()),
      )
  )
    return;
  const parameters = parameterBindingsOf({ site, sourceCode: context.sourceCode });
  const lastRead = parameters.reduce(
    (latest, binding) => (binding.read ? Math.max(latest, binding.index) : latest),
    site.params.findLastIndex((parameter) => parameter.type === "TSParameterProperty"),
  );
  parameters.forEach(({ index, kind, identifier, read }) => {
    if (!read && (kind === "destructured" || index >= lastRead)) {
      context.report({ node: identifier, messageId: "unread", data: { name: identifier.name } });
    }
  });
};

const unreadParameter: Pick<TypescriptEslintRule, "meta" | "create"> = {
  meta: {
    type: "problem",
    docs: { description: "Find unread function parameters and destructured fields" },
    schema: [],
    messages: {
      unread:
        "The signature asks callers to supply {{name}}, but the unit never reads it. Callers build input that does not affect the result.",
    },
  },
  create: (context) => ({
    FunctionDeclaration: (site) => observeParameters({ context, site }),
    FunctionExpression: (site) => observeParameters({ context, site }),
    ArrowFunctionExpression: (site) => observeParameters({ context, site }),
  }),
};

export default {
  meta: { name: "hone-wide-input", version: "0.0.0-local" },
  rules: { "unread-parameter": unreadParameter },
};
