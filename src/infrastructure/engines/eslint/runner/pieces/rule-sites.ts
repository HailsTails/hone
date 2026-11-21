import type { Rule } from "../toolchain/eslint-instance.ts";

type ListenedNode<Key extends string> = Parameters<NonNullable<Rule.RuleListener[Key]>>[0];

export type RuleMeta = NonNullable<Rule.RuleModule["meta"]>;

export type FileSite = ListenedNode<"Program">;

export type FunctionSite =
  | ListenedNode<"FunctionDeclaration">
  | ListenedNode<"FunctionExpression">
  | ListenedNode<"ArrowFunctionExpression">;

export type ClassSite = ListenedNode<"ClassDeclaration"> | ListenedNode<"ClassExpression">;

export type CallSite = ListenedNode<"CallExpression">;

export type ThrowSite = ListenedNode<"ThrowStatement">;

export type IfSite = ListenedNode<"IfStatement">;

export type VariableDeclarationSite = ListenedNode<"VariableDeclaration">;

export type SiteObservers = {
  readonly file?: (site: FileSite) => void;
  readonly functions?: (site: FunctionSite) => void;
  readonly classes?: (site: ClassSite) => void;
  readonly calls?: (site: CallSite) => void;
  readonly throws?: (site: ThrowSite) => void;
  readonly ifs?: (site: IfSite) => void;
  readonly variableDeclarations?: (site: VariableDeclarationSite) => void;
};

export type SiteRuleDefinition = {
  readonly meta: RuleMeta;
  readonly observe: (context: Rule.RuleContext) => SiteObservers;
};

const everyListener = (observers: SiteObservers): Rule.RuleListener => ({
  Program: observers.file,
  FunctionDeclaration: observers.functions,
  FunctionExpression: observers.functions,
  ArrowFunctionExpression: observers.functions,
  ClassDeclaration: observers.classes,
  ClassExpression: observers.classes,
  CallExpression: observers.calls,
  ThrowStatement: observers.throws,
  IfStatement: observers.ifs,
  VariableDeclaration: observers.variableDeclarations,
});

const listenerOf = (observers: SiteObservers): Rule.RuleListener =>
  Object.fromEntries(Object.entries(everyListener(observers)).filter(([, listen]) => listen !== undefined));

export const functionSiteOf = (request: { readonly node: Rule.Node }): FunctionSite | undefined => {
  const node = request.node;
  return node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression"
    ? node
    : undefined;
};

export const siteRule = (definition: SiteRuleDefinition): Rule.RuleModule => ({
  meta: definition.meta,
  create: (context) => listenerOf(definition.observe(context)),
});
