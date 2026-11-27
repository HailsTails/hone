type Position = { readonly line: number; readonly column: number };

export type SourceLocation = { readonly start: Position; readonly end: Position };

export type SyntaxNode = Readonly<Record<string, unknown>> & {
  readonly type: string;
  readonly parent?: SyntaxNode | null;
  readonly loc?: SourceLocation | null;
  readonly range?: readonly [number, number];
};

type SourceToken = {
  readonly type: string;
  readonly value: string;
  readonly range: readonly [number, number];
  readonly loc: SourceLocation;
};

export type SourceCode = {
  readonly text: string;
  readonly visitorKeys: Readonly<Record<string, readonly string[]>>;
  readonly getFirstToken: (node: SyntaxNode) => SourceToken | null;
  readonly getTokenBefore: (node: SyntaxNode | SourceToken) => SourceToken | null;
  readonly getTokenAfter: (node: SyntaxNode) => SourceToken | null;
  readonly getTokens: (node: SyntaxNode) => readonly SourceToken[];
  readonly getNodeByRangeIndex: (index: number) => SyntaxNode | null;
};

export type RuleContext = {
  readonly filename: string;
  readonly options: readonly unknown[];
  readonly sourceCode: SourceCode;
  readonly report: (
    finding: {
      readonly node?: SyntaxNode;
      readonly loc?: Position | SourceLocation;
      readonly data?: Readonly<Record<string, string>>;
    } & ({ readonly messageId: string } | { readonly message: string }),
  ) => void;
};

export type RuleMeta = {
  readonly type: "problem" | "suggestion";
  readonly docs: { readonly description: string };
  readonly schema: readonly unknown[];
  readonly messages: Readonly<Record<string, string>>;
};

export type FileSite = SyntaxNode;

export type FunctionSite = SyntaxNode & {
  readonly type: "FunctionDeclaration" | "FunctionExpression" | "ArrowFunctionExpression";
  readonly body: SyntaxNode;
};

export type ClassSite = SyntaxNode & {
  readonly type: "ClassDeclaration" | "ClassExpression";
};

export type CallSite = SyntaxNode & { readonly callee: SyntaxNode };

export type ThrowSite = SyntaxNode & { readonly argument: SyntaxNode };

export type IfSite = SyntaxNode & {
  readonly consequent: SyntaxNode;
  readonly alternate?: SyntaxNode | null;
};

export type VariableDeclarationSite = SyntaxNode & {
  readonly kind: string;
  readonly declarations: readonly { readonly init?: unknown; readonly id: SyntaxNode }[];
};

export const isSyntaxNode = (candidate: unknown): candidate is SyntaxNode =>
  typeof candidate === "object" &&
  candidate !== null &&
  "type" in candidate &&
  typeof candidate.type === "string";

export const readNode = (candidate: unknown): SyntaxNode | undefined =>
  isSyntaxNode(candidate) ? candidate : undefined;

export const readNodes = (candidate: unknown): readonly SyntaxNode[] =>
  Array.isArray(candidate) ? candidate.filter(isSyntaxNode) : [];

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
  readonly observe: (context: RuleContext) => SiteObservers;
};

const listenerOf = (observers: SiteObservers) =>
  Object.fromEntries(
    (
      [
        ["Program", observers.file],
        ["FunctionDeclaration", observers.functions],
        ["FunctionExpression", observers.functions],
        ["ArrowFunctionExpression", observers.functions],
        ["ClassDeclaration", observers.classes],
        ["ClassExpression", observers.classes],
        ["CallExpression", observers.calls],
        ["ThrowStatement", observers.throws],
        ["IfStatement", observers.ifs],
        ["VariableDeclaration", observers.variableDeclarations],
      ] as const
    ).filter(([, listen]) => listen !== undefined),
  );

export const isFunctionSite = (node: SyntaxNode): node is FunctionSite => {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
};

export const siteRule = (definition: SiteRuleDefinition) => ({
  meta: definition.meta,
  create: (context: RuleContext) => listenerOf(definition.observe(context)),
});
