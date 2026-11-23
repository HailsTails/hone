import { builtInImportOf } from "../../runner/pieces/node-built-in-import.ts";
import { sourceValueLookupOf } from "../../runner/pieces/source-bindings.ts";
import { typeScriptSourceEligibility } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

type SyntaxRequest = {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
  readonly declarationsOf: (node: SyntaxNode) => readonly SyntaxNode[];
};

const PROCESS_MEMBERS = new Set(["env", "argv", "exit", "on"]);

const processOrConsole = ({
  syntaxApi,
  node,
  declarationsOf,
}: SyntaxRequest): SyntaxNode | undefined => {
  if (!syntaxApi.isPropertyAccessExpression(node) && !syntaxApi.isElementAccessExpression(node))
    return undefined;
  const receiver = node.expression;
  if (
    !syntaxApi.isIdentifier(receiver) ||
    (receiver.text !== "process" && receiver.text !== "console")
  )
    return undefined;
  if (declarationsOf(receiver).length > 0) {
    const imported = builtInImportOf({
      syntaxApi,
      identifier: receiver,
      declarationsOf,
      builtIn: receiver.text,
    });
    if (imported === undefined || imported.kind === "named") return undefined;
  }
  if (receiver.text === "console") return node;
  if (syntaxApi.isPropertyAccessExpression(node))
    return PROCESS_MEMBERS.has(node.name.text) ? node : undefined;
  return syntaxApi.isStringLiteralLike(node.argumentExpression) &&
    PROCESS_MEMBERS.has(node.argumentExpression.text)
    ? node
    : undefined;
};

const globalThisRead = ({
  syntaxApi,
  node,
  declarationsOf,
}: SyntaxRequest): SyntaxNode | undefined => {
  if (!syntaxApi.isIdentifier(node) || node.text !== "globalThis") return undefined;
  const parent = node.parent;
  if (
    syntaxApi.isTypeNode(parent) ||
    syntaxApi.isQualifiedName(parent) ||
    syntaxApi.isBindingElement(parent)
  )
    return undefined;
  if (
    syntaxApi.isJsxOpeningElement(parent) ||
    syntaxApi.isJsxSelfClosingElement(parent) ||
    syntaxApi.isJsxClosingElement(parent)
  )
    return undefined;
  if (syntaxApi.isImportSpecifier(parent) || syntaxApi.isExportSpecifier(parent)) return undefined;
  if ("label" in parent && parent.label === node) return undefined;
  if ("name" in parent && parent.name === node && !syntaxApi.isShorthandPropertyAssignment(parent))
    return undefined;
  return declarationsOf(node).length > 0 ? undefined : node;
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (typeScriptSourceEligibility({ file }) === "skipped")
          return { outcome: "ok", value: { kind: "skipped" } };
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              const declarationsOf = sourceValueLookupOf({ syntaxApi, sourceFile });
              return {
                enter: ({ node }) => {
                  const use =
                    processOrConsole({ syntaxApi, node, declarationsOf }) ??
                    globalThisRead({ syntaxApi, node, declarationsOf });
                  if (use === undefined) return;
                  const anchor = anchorAt({ position: use.getStart(sourceFile) });
                  const snippet = use.getText(sourceFile).replace(/\r?\n/g, " ");
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
