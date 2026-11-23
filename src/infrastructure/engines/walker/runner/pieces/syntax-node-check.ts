import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../toolchain/typescript-parse.ts";
import { sourceSnippetOf } from "./source-snippet.ts";
import type { PieceHit, WalkerPiece } from "./walker-piece.ts";

export type SyntaxVisit = {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
  readonly sourceFile: SyntaxTree;
};

export const syntaxNodeCheck = (request: {
  readonly eligibility: (request: { readonly file: RepoPath }) => "eligible" | "skipped";
  readonly found: (
    visit: SyntaxVisit,
  ) => { readonly at: SyntaxNode; readonly snippet: string } | undefined;
}): WalkerPiece => ({
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) =>
        request.eligibility({ file }) === "skipped" || bindings.length === 0
          ? { outcome: "ok", value: { kind: "skipped" } }
          : {
              outcome: "ok",
              value: {
                kind: "syntax",
                begin: ({ sourceFile, anchorAt }) => {
                  const hits: PieceHit[] = [];
                  return {
                    enter: ({ node }) => {
                      const sight = request.found({ syntaxApi, node, sourceFile });
                      if (sight === undefined) return;
                      const anchor = anchorAt({ position: sight.at.getStart(sourceFile) });
                      hits.push(
                        ...bindings.map(({ address }) => ({
                          check: address,
                          anchor,
                          snippet: sourceSnippetOf(sight.snippet),
                        })),
                      );
                    },
                    finish: () => hits,
                  };
                },
              },
            },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
});
