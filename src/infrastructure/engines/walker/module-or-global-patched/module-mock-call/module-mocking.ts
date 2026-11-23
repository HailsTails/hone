import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { editionReaches } from "../../../../../domain/rule-set/edition-reach.ts";
import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const GLOBAL_PATCH_EDITION = editionOf("2");

const snippetAt = (request: { readonly source: string; readonly position: number }): string => {
  const snippet = request.source.slice(request.position, request.position + 80).replace(/\n/g, " ");
  return snippet.length === 80 ? `${snippet}…` : snippet;
};

const memberOf = ({
  syntaxApi,
  node,
}: SyntaxRequest): { readonly receiver: SyntaxNode; readonly name: string } | undefined => {
  if (syntaxApi.isPropertyAccessExpression(node))
    return { receiver: node.expression, name: node.name.text };
  if (
    syntaxApi.isElementAccessExpression(node) &&
    syntaxApi.isStringLiteralLike(node.argumentExpression)
  ) {
    return { receiver: node.expression, name: node.argumentExpression.text };
  }
  return undefined;
};

const environmentOf = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
  const member = memberOf({ syntaxApi, node });
  if (
    member?.name !== "env" ||
    !syntaxApi.isIdentifier(member.receiver) ||
    member.receiver.text !== "process"
  )
    return undefined;
  return node;
};

const writtenTarget = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
  const kind = syntaxApi.SyntaxKind;
  if (
    syntaxApi.isBinaryExpression(node) &&
    node.operatorToken.kind >= kind.FirstAssignment &&
    node.operatorToken.kind <= kind.LastAssignment
  )
    return node.left;
  if (syntaxApi.isDeleteExpression(node)) return node.expression;
  if (
    (syntaxApi.isPrefixUnaryExpression(node) || syntaxApi.isPostfixUnaryExpression(node)) &&
    (node.operator === kind.PlusPlusToken || node.operator === kind.MinusMinusToken)
  )
    return node.operand;
  return undefined;
};

const globalPatchOf = (request: SyntaxRequest): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isCallExpression(node)) {
    const member = memberOf({ syntaxApi, node: node.expression });
    return member?.name === "stubGlobal" &&
      syntaxApi.isIdentifier(member.receiver) &&
      member.receiver.text === "vi"
      ? node
      : undefined;
  }
  const target = writtenTarget(request);
  if (target === undefined) return undefined;
  if (environmentOf({ syntaxApi, node: target }) !== undefined) return node;
  if (!syntaxApi.isPropertyAccessExpression(target) && !syntaxApi.isElementAccessExpression(target))
    return undefined;
  return environmentOf({ syntaxApi, node: target.expression }) === undefined ? undefined : node;
};

const moduleMockOf = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  return syntaxApi.isPropertyAccessExpression(callee) &&
    callee.name.text === "mock" &&
    syntaxApi.isIdentifier(callee.expression) &&
    callee.expression.text === "vi"
    ? node
    : undefined;
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file }) === "skipped" || bindings.length === 0) {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        const globalPatchBindings = bindings.filter(
          ({ edition }) =>
            editionReaches({ edition, introducedIn: GLOBAL_PATCH_EDITION }) === "reached",
        );
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const findingBindings =
                    moduleMockOf({ syntaxApi, node }) !== undefined
                      ? bindings
                      : globalPatchBindings.length > 0 &&
                          globalPatchOf({ syntaxApi, node }) !== undefined
                        ? globalPatchBindings
                        : [];
                  if (findingBindings.length === 0) return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = snippetAt({ source: sourceFile.text, position });
                  hits.push(
                    ...findingBindings.map(({ address }) => ({ check: address, anchor, snippet })),
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
