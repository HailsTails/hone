import type { SyntaxApi, SyntaxNode } from "../src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts";

type NodeSearch = {
  readonly syntaxApi: SyntaxApi;
  readonly start: number;
  readonly kind: number;
};

const outermostAt = (request: NodeSearch & { readonly node: SyntaxNode }): SyntaxNode | undefined => {
  if (request.node.kind === request.kind && request.node.getStart() === request.start) return request.node;
  return request.syntaxApi.forEachChild(request.node, (child) => outermostAt({ ...request, node: child }));
};

export const syntaxNodeOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly source: string;
  readonly text: string;
  readonly kind: number;
}): SyntaxNode | undefined => {
  const tree = request.syntaxApi.createSourceFile("node.test.ts", request.source, request.syntaxApi.ScriptTarget.Latest, true);
  return outermostAt({ syntaxApi: request.syntaxApi, start: request.source.indexOf(request.text), kind: request.kind, node: tree });
};
