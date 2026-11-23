import { parameterBinding } from "../../runner/pieces/parameter-binding.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const SOURCE_ENDINGS = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_ENDINGS = [".d.ts", ".d.mts", ".d.cts"];
const PROCESS_MEMBERS = new Set(["env", "argv", "exit", "on"]);

const processOrConsole = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
  if (!syntaxApi.isPropertyAccessExpression(node) && !syntaxApi.isElementAccessExpression(node))
    return undefined;
  const receiver = node.expression;
  if (
    !syntaxApi.isIdentifier(receiver) ||
    (receiver.text !== "process" && receiver.text !== "console")
  )
    return undefined;
  if (parameterBinding({ syntaxApi, node, name: receiver.text }) === "local") return undefined;
  if (receiver.text === "console") return node;
  if (syntaxApi.isPropertyAccessExpression(node))
    return PROCESS_MEMBERS.has(node.name.text) ? node : undefined;
  return syntaxApi.isStringLiteralLike(node.argumentExpression) &&
    PROCESS_MEMBERS.has(node.argumentExpression.text)
    ? node
    : undefined;
};

const globalThisRead = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
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
  return parameterBinding({ syntaxApi, node: parent, name: node.text }) === "local"
    ? undefined
    : node;
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
                  const use =
                    processOrConsole({ syntaxApi, node }) ?? globalThisRead({ syntaxApi, node });
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
