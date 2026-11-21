import type { DeclarationPort, EmittedDeclaration } from "../delivery/packaging/type-declarations/package-declarations.ts";

export const ENTRY_DECLARATIONS: readonly EmittedDeclaration[] = [
  { path: "src/audit.d.ts", text: 'export type { Result } from "./domain/result.js";\n', specifiers: ["./domain/result.js"], refusals: [] },
  { path: "src/eslint-plugin.d.ts", text: "export type ChecksPlugin = 1;\n", specifiers: [], refusals: [] },
  { path: "src/rule-set.d.ts", text: "export type RuleSet = 1;\n", specifiers: [], refusals: [] },
  { path: "src/testing.d.ts", text: "export declare const repoPathOf: 1;\n", specifiers: [], refusals: [] },
  { path: "src/domain/result.d.ts", text: "export type Result = 1;\n", specifiers: [], refusals: [] },
];

export const emittingDeclarations = (request: { readonly declarations: readonly EmittedDeclaration[] }): DeclarationPort => ({
  emit: () => Promise.resolve({ outcome: "ok", value: { declarations: request.declarations, diagnostics: [] } }),
});
