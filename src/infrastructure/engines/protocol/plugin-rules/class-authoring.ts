import { type ClassSite, type RuleContext, siteRule, type SyntaxNode } from "./rule-sites.ts";

export type ClassSyntax = {
  readonly filename: string;
  readonly kind: "declaration" | "expression";
  readonly declaration: "ambient" | "runtime";
  readonly container: "ambient" | "runtime";
};
export type ClassDisposition = "allow" | "report";
export type ClassAncestor = {
  readonly type: string;
  readonly declare?: unknown;
  readonly parent?: ClassAncestor | null | undefined;
};

export const classDisposition = (syntax: ClassSyntax): ClassDisposition => {
  if (syntax.kind === "expression") return "report";
  if (/\.d\.[cm]?ts$/u.test(syntax.filename)) return "allow";
  if (syntax.declaration === "ambient") return "allow";
  if (syntax.container === "ambient") return "allow";
  return "report";
};
const declarationMode = ({ node }: { readonly node: object }): "ambient" | "runtime" =>
  "declare" in node && node.declare === true ? "ambient" : "runtime";
export const containerMode = ({
  node,
}: {
  readonly node: ClassAncestor | null | undefined;
}): "ambient" | "runtime" => {
  if (node === undefined || node === null) return "runtime";
  if (node.type === "TSModuleDeclaration" && declarationMode({ node }) === "ambient")
    return "ambient";
  return containerMode({ node: node.parent });
};
const classKeywordToken = ({
  context,
  node,
}: {
  readonly context: RuleContext;
  readonly node: SyntaxNode;
}) =>
  context.sourceCode
    .getTokens(node)
    .find(
      (token) =>
        token.type === "Keyword" &&
        token.value === "class" &&
        context.sourceCode.getNodeByRangeIndex(token.range[0]) === node,
    );
const reportAtClassKeyword = ({
  context,
  node,
}: {
  readonly context: RuleContext;
  readonly node: SyntaxNode;
}): void => {
  const keyword = classKeywordToken({ context, node });
  if (keyword === undefined) {
    context.report({ node, messageId: "noClass" });
    return;
  }
  context.report({ loc: keyword.loc, messageId: "noClass" });
};
const classKindOf = ({ node }: { readonly node: ClassSite }): ClassSyntax["kind"] => {
  switch (node.type) {
    case "ClassDeclaration":
      return "declaration";
    case "ClassExpression":
      return "expression";
  }
};
const noClassAuthoring = siteRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow authored runtime classes (CD-14)" },
    schema: [],
    messages: {
      noClass: "CD-14: use functions and closure-backed factories instead of authoring a class.",
    },
  },
  observe: (context) => {
    const reportClass = ({
      node,
      kind,
    }: {
      readonly node: SyntaxNode;
      readonly kind: "declaration" | "expression";
    }): void => {
      const disposition = classDisposition({
        filename: context.filename,
        kind,
        declaration: declarationMode({ node }),
        container: containerMode({ node: node.parent }),
      });
      if (disposition === "allow") return;
      reportAtClassKeyword({ context, node });
    };
    return {
      classes: (node) => reportClass({ node, kind: classKindOf({ node }) }),
    };
  },
});

export default {
  meta: { name: "hone", version: "0.0.0-local" },
  rules: { "no-class-authoring": noClassAuthoring },
};
