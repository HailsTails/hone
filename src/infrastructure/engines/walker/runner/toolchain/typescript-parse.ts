import type typescript from "typescript";

export type SyntaxApi = typeof typescript;
export type SyntaxTree = typescript.SourceFile;
export type SyntaxNode = typescript.Node;
export type CommentRange = typescript.CommentRange;
export type Statement = typescript.Statement;
export type ImportDeclaration = typescript.ImportDeclaration;
export type CallExpression = typescript.CallExpression;
export type PropertyAccessExpression = typescript.PropertyAccessExpression;
export type ExportDeclaration = typescript.ExportDeclaration;
export type ExportAssignment = typescript.ExportAssignment;
export type Diagnostic = typescript.Diagnostic;
export type CompilerOptions = typescript.CompilerOptions;
export type CustomTransformers = typescript.CustomTransformers;

export type TypeScriptParsePort = {
  readonly syntaxApi: SyntaxApi;
  readonly parse: (request: { readonly fileName: string; readonly source: string }) => SyntaxTree;
  readonly children: (request: { readonly node: SyntaxNode }) => readonly SyntaxNode[];
};

export type TypeScriptModules = {
  readonly typescript: () => Promise<{ readonly default: SyntaxApi }>;
};

export const defaultTypeScriptModules: TypeScriptModules = {
  typescript: () => import("typescript"),
};
