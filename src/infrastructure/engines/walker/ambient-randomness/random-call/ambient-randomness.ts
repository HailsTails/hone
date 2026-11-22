import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

const SOURCE_ENDINGS = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_ENDINGS = [".d.ts", ".d.mts", ".d.cts"];
const RANDOM_CALLS = new Set(["Math.random", "crypto.randomUUID", "crypto.getRandomValues"]);

const randomCall = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (!syntaxApi.isPropertyAccessExpression(callee) && !syntaxApi.isElementAccessExpression(callee))
    return undefined;
  if (!syntaxApi.isIdentifier(callee.expression)) return undefined;
  const member = syntaxApi.isPropertyAccessExpression(callee)
    ? callee.name
    : callee.argumentExpression;
  if (!syntaxApi.isIdentifier(member) && !syntaxApi.isStringLiteralLike(member)) return undefined;
  if (syntaxApi.isElementAccessExpression(callee) && !syntaxApi.isStringLiteralLike(member))
    return undefined;
  return RANDOM_CALLS.has(`${callee.expression.text}.${member.text}`) ? callee : undefined;
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (
          folderScope({ file }) === "generated" ||
          !SOURCE_ENDINGS.some((ending) => file.endsWith(ending)) ||
          DECLARATION_ENDINGS.some((ending) => file.endsWith(ending))
        )
          return { outcome: "ok", value: { kind: "skipped" } };
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const callee = randomCall({ syntaxApi, node });
                  if (callee === undefined) return;
                  const anchor = anchorAt({ position: callee.getStart(sourceFile) });
                  const snippet = callee.getText(sourceFile).replace(/\r?\n/g, " ");
                  hits.push(
                    ...bindings.map(({ address }) => ({ check: address, anchor, snippet })),
                  );
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
