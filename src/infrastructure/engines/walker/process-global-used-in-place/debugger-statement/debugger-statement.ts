import { typeScriptSourceEligibility } from "../../runner/pieces/source-scope.ts";
import { syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";

export const check = syntaxNodeCheck({
  eligibility: typeScriptSourceEligibility,
  found: ({ syntaxApi, node }) =>
    syntaxApi.isDebuggerStatement(node) ? { at: node, snippet: "debugger" } : undefined,
});
