import { readNode, siteRule, type SyntaxNode } from "./rule-sites.ts";

type DeclaredBinding = {
  readonly init?: unknown;
  readonly id: object;
};

type ImplicitAnyDisposition = "implicit-any" | "typed-or-initialised";

const DECLARATION_FILE = /\.d\.[cm]?ts$/u;

const TYPESCRIPT_FILE = /\.[cm]?tsx?$/u;

const LOOP_HEADS: ReadonlySet<string> = new Set(["ForInStatement", "ForOfStatement"]);

const bindingDisposition = (request: {
  readonly binding: DeclaredBinding;
}): ImplicitAnyDisposition =>
  (request.binding.init ?? null) === null &&
  !("typeAnnotation" in request.binding.id && request.binding.id.typeAnnotation)
    ? "implicit-any"
    : "typed-or-initialised";

const governedFile = (request: { readonly filename: string }): "governed" | "not-governed" =>
  TYPESCRIPT_FILE.test(request.filename) && !DECLARATION_FILE.test(request.filename)
    ? "governed"
    : "not-governed";

const loopHeadDisposition = (request: { readonly node: SyntaxNode }): "loop-head" | "statement" => {
  const parent = readNode(request.node.parent);
  return parent !== undefined && LOOP_HEADS.has(parent.type) ? "loop-head" : "statement";
};

const implicitAnyLet = siteRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow let and var declarations with neither a type nor an initialiser (CD-1)",
    },
    schema: [],
    messages: {
      implicitAny:
        "CD-1: give this variable a type annotation or an initialiser so it is not implicitly any.",
    },
  },
  observe: (context) => ({
    variableDeclarations: (node) => {
      if (
        node.kind === "const" ||
        governedFile({ filename: context.filename }) === "not-governed"
      ) {
        return;
      }
      if (loopHeadDisposition({ node }) === "loop-head") {
        return;
      }
      const implicit = node.declarations.find(
        (binding) => bindingDisposition({ binding }) === "implicit-any",
      );
      if (implicit === undefined || implicit.id.type !== "Identifier") {
        return;
      }
      context.report({ node: implicit.id, messageId: "implicitAny" });
    },
  }),
});

export default {
  meta: { name: "hone-implicit-any-let", version: "0.0.0-local" },
  rules: { "implicit-any-let": implicitAnyLet },
};
