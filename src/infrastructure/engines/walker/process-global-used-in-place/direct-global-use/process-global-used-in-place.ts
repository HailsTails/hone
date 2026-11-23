import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { editionReaches } from "../../../../../domain/rule-set/edition-reach.ts";
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
const DIALOGS = new Set(["alert", "confirm", "prompt"]);
const FIRST_DIALOG_EDITION = editionOf("2");

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

const browserDialogOf = ({ syntaxApi, node }: SyntaxRequest) => {
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (syntaxApi.isIdentifier(callee)) {
    return DIALOGS.has(callee.text) ? { use: callee, binding: callee } : undefined;
  }
  if (!syntaxApi.isPropertyAccessExpression(callee) && !syntaxApi.isElementAccessExpression(callee))
    return undefined;
  const receiver = callee.expression;
  if (!syntaxApi.isIdentifier(receiver) || receiver.text !== "window") return undefined;
  const member = syntaxApi.isPropertyAccessExpression(callee)
    ? callee.name
    : callee.argumentExpression;
  if (syntaxApi.isElementAccessExpression(callee) && !syntaxApi.isStringLiteralLike(member))
    return undefined;
  return (syntaxApi.isIdentifier(member) || syntaxApi.isStringLiteralLike(member)) &&
    DIALOGS.has(member.text)
    ? { use: callee, binding: receiver }
    : undefined;
};

const unboundDialogOf = (request: SyntaxRequest): SyntaxNode | undefined => {
  const dialog = browserDialogOf(request);
  return dialog !== undefined && request.declarationsOf(dialog.binding).length === 0
    ? dialog.use
    : undefined;
};

export const check: WalkerPiece = {
  prepare: ({ bindings, syntaxApi }) => {
    const dialogBindings = bindings.filter(
      ({ edition }) =>
        editionReaches({ edition, introducedIn: FIRST_DIALOG_EDITION }) === "reached",
    );
    return {
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
                    const existingUse =
                      processOrConsole({ syntaxApi, node, declarationsOf }) ??
                      globalThisRead({ syntaxApi, node, declarationsOf });
                    const active = existingUse === undefined ? dialogBindings : bindings;
                    if (active.length === 0) return;
                    const use = existingUse ?? unboundDialogOf({ syntaxApi, node, declarationsOf });
                    if (use === undefined) return;
                    const anchor = anchorAt({ position: use.getStart(sourceFile) });
                    const snippet = use.getText(sourceFile).replace(/\r?\n/g, " ");
                    hits.push(
                      ...active.map(({ address }) => ({ check: address, anchor, snippet })),
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
    };
  },
};
