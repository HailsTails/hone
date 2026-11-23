import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";
import type { SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

const enclosingAugmentation = ({
  syntaxApi,
  node,
}: Pick<SyntaxVisit, "syntaxApi" | "node">): SyntaxNode | undefined => {
  const container = node.parent;
  if (syntaxApi.isSourceFile(container)) return undefined;
  if (
    syntaxApi.isModuleDeclaration(container) &&
    (syntaxApi.isStringLiteral(container.name) ||
      (container.flags & syntaxApi.NodeFlags.GlobalAugmentation) !== 0)
  )
    return container;
  return enclosingAugmentation({ syntaxApi, node: container });
};

export const check = syntaxNodeCheck({
  eligibility: testFileEligibility,
  found: ({ syntaxApi, node, sourceFile }) =>
    (syntaxApi.isTypeAliasDeclaration(node) ||
      syntaxApi.isInterfaceDeclaration(node) ||
      syntaxApi.isEnumDeclaration(node)) &&
    enclosingAugmentation({ syntaxApi, node }) === undefined
      ? { at: node, snippet: node.name.getText(sourceFile) }
      : undefined,
});
