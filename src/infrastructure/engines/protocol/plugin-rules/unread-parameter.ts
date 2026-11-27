import { z } from "zod";

import {
  isSyntaxNode,
  readNode,
  readNodes,
  type RuleContext,
  type RuleMeta,
  type SyntaxNode,
} from "./rule-sites.ts";

type Identifier = SyntaxNode & {
  readonly name: string;
  readonly range: readonly [number, number];
  readonly parent: SyntaxNode;
};

type Reference = {
  readonly access: "read" | "unread";
  readonly use: "type" | "value";
  readonly identifier: Identifier;
};

type ScopedVariable<ScopeReference> = {
  readonly name: string;
  readonly defs: readonly { readonly type: string }[];
  readonly identifiers: readonly Identifier[];
  readonly references: readonly ScopeReference[];
};

type FunctionSite = SyntaxNode & {
  readonly params: readonly (SyntaxNode & { readonly range: readonly [number, number] })[];
  readonly parent: SyntaxNode;
};

type SourceCode<ScopeReference = Reference> = {
  readonly getDeclaredVariables: (site: FunctionSite) => readonly ScopedVariable<ScopeReference>[];
  readonly getAncestors: (site: SyntaxNode) => readonly SyntaxNode[];
  readonly getScope: (site: FunctionSite) => {
    readonly variables: readonly ScopedVariable<ScopeReference>[];
  };
};

type UnreadRuleContext = Pick<RuleContext, "report"> & { readonly sourceCode: SourceCode };

type PluginContext = Pick<RuleContext, "report"> & { readonly sourceCode: SourceCode<unknown> };

const referenceSchema = z.object({
  isRead: z.function({ input: [], output: z.boolean() }),
  isValueReference: z.boolean().optional(),
  identifier: z.custom<Identifier>(
    (node) =>
      isSyntaxNode(node) &&
      typeof node.name === "string" &&
      node.range !== undefined &&
      isSyntaxNode(node.parent),
  ),
});

const mapReference = (candidate: unknown): Reference => {
  const reference = referenceSchema.parse(candidate);
  return {
    access: reference.isRead.call(candidate) ? "read" : "unread",
    use: reference.isValueReference === false ? "type" : "value",
    identifier: reference.identifier,
  };
};

const mapVariable = (variable: ScopedVariable<unknown>): ScopedVariable<Reference> => ({
  ...variable,
  references: variable.references.map(mapReference),
});

const createRuleContext = (context: PluginContext): UnreadRuleContext => ({
  report: (finding) => context.report(finding),
  sourceCode: {
    getDeclaredVariables: (site) => context.sourceCode.getDeclaredVariables(site).map(mapVariable),
    getAncestors: (site) => context.sourceCode.getAncestors(site),
    getScope: (site) => ({
      variables: context.sourceCode.getScope(site).variables.map(mapVariable),
    }),
  },
});

const valueUse = (request: {
  readonly reference: Reference;
  readonly sourceCode: SourceCode;
}): "read" | "unread" => {
  const { reference, sourceCode } = request;
  if (reference.access === "unread" || reference.use === "type") return "unread";
  const { identifier } = reference;
  if (identifier.type !== "Identifier") return "read";
  const { parent } = identifier;
  if (
    (parent.type === "UpdateExpression" ||
      (parent.type === "AssignmentExpression" && parent.left === identifier)) &&
    readNode(parent.parent)?.type === "ExpressionStatement"
  )
    return "unread";
  return sourceCode
    .getAncestors(identifier)
    .some(({ type }) => type === "TSTypeQuery" || type === "TSTypePredicate")
    ? "unread"
    : "read";
};

const bindingReach = (request: {
  readonly identifier: Identifier;
  readonly parameter: FunctionSite["params"][number];
}): "inside" | "outside" => {
  const identifier = request.identifier.range;
  const parameter = request.parameter.range;
  return identifier[0] >= parameter[0] && identifier[1] <= parameter[1] ? "inside" : "outside";
};

const restDisposition = (identifier: Identifier): "excluded" | "included" => {
  const parent = identifier.parent;
  const entry =
    parent.type === "AssignmentPattern" && parent.left === identifier ? parent : identifier;
  const containing = readNode(entry.parent);
  if (containing?.type === "Property" && containing.value === entry) {
    const pattern = readNode(containing.parent);
    return pattern?.type === "ObjectPattern" &&
      readNodes(pattern.properties).some((property) => property.type === "RestElement")
      ? "excluded"
      : "included";
  }
  return containing?.type === "ArrayPattern" &&
    readNodes(containing.elements).some((element) => element.type === "RestElement")
    ? "excluded"
    : "included";
};

const bindingKindOf = (parameter: FunctionSite["params"][number]): "destructured" | "slot" => {
  const binding = parameter.type === "AssignmentPattern" ? readNode(parameter.left) : parameter;
  return binding?.type === "ArrayPattern" || binding?.type === "ObjectPattern"
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
    if (
      identifier === undefined ||
      identifier.name === "this" ||
      restDisposition(identifier) === "excluded"
    )
      return [];
    const index = request.site.params.findIndex(
      (parameter) => bindingReach({ identifier, parameter }) === "inside",
    );
    const parameter = request.site.params[index];
    return parameter === undefined || parameter.type === "TSParameterProperty"
      ? []
      : [
          {
            index,
            kind: bindingKindOf(parameter),
            identifier,
            read: variable.references.some(
              (reference) => valueUse({ reference, sourceCode: request.sourceCode }) === "read",
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
          variable.references.some((reference) => reference.access === "read"),
      )
  )
    return;
  const parameterBindings = parameterBindingsOf({ site, sourceCode: context.sourceCode });
  const lastRead = parameterBindings.reduce(
    (latest, binding) => (binding.read ? Math.max(latest, binding.index) : latest),
    site.params.findLastIndex((parameter) => parameter.type === "TSParameterProperty"),
  );
  parameterBindings.forEach(({ index, kind, identifier, read }) => {
    if (!read && (kind === "destructured" || index >= lastRead)) {
      context.report({ node: identifier, messageId: "unread", data: { name: identifier.name } });
    }
  });
};

const unreadParameter: {
  readonly meta: RuleMeta;
  readonly create: (
    context: PluginContext,
  ) => Readonly<Record<string, (site: FunctionSite) => void>>;
} = {
  meta: {
    type: "problem",
    docs: { description: "Find unread function parameters and destructured fields" },
    schema: [],
    messages: {
      unread:
        "The signature asks callers to supply {{name}}, but the unit never reads it. Callers build input that does not affect the result.",
    },
  },
  create: (pluginContext) => {
    const context = createRuleContext(pluginContext);
    const observe = (site: FunctionSite) => observeParameters({ context, site });
    return Object.fromEntries(
      ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].map((event) => [
        event,
        observe,
      ]),
    );
  },
};

export default {
  meta: { name: "hone-wide-input", version: "0.0.0-local" },
  rules: { "unread-parameter": unreadParameter },
};
