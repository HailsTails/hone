import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";

const exportAt = ({ syntaxApi, node, sourceFile }: SyntaxVisit) => {
  if (node.parent !== sourceFile) return undefined;
  if (syntaxApi.isExportAssignment(node)) return node;
  if (syntaxApi.isExportDeclaration(node)) {
    const clause = node.exportClause;
    if (clause !== undefined && syntaxApi.isNamedExports(clause) && clause.elements.length === 0)
      return undefined;
    return node;
  }
  return syntaxApi.canHaveModifiers(node)
    ? syntaxApi
        .getModifiers(node)
        ?.find((modifier) => modifier.kind === syntaxApi.SyntaxKind.ExportKeyword)
    : undefined;
};

export const check = syntaxNodeCheck({
  eligibility: testFileEligibility,
  found: (visit) => {
    const at = exportAt(visit);
    return at === undefined ? undefined : { at, snippet: "export" };
  },
});
