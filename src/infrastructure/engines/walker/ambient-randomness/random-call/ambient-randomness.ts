import { type BuiltInImport, builtInImportOf } from "../../runner/pieces/node-built-in-import.ts";
import { sourceValueLookupOf } from "../../runner/pieces/source-bindings.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

const SOURCE_ENDINGS = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_ENDINGS = [".d.ts", ".d.mts", ".d.cts"];
const CRYPTO_RANDOM_METHODS = new Set(["randomUUID", "getRandomValues"]);

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };
type DeclarationsOf = (node: SyntaxNode) => readonly SyntaxNode[];
type CryptoKind = "node-module" | "node-namespace" | "web-crypto" | "random-function";
type CryptoReceiver = Exclude<CryptoKind, "random-function">;
type CallContext = {
  readonly syntaxApi: SyntaxApi;
  readonly declarationsOf: DeclarationsOf;
};

const memberOf = ({ syntaxApi, node }: SyntaxRequest) => {
  if (syntaxApi.isPropertyAccessExpression(node)) {
    return { receiver: node.expression, name: node.name.text };
  }
  if (
    syntaxApi.isElementAccessExpression(node) &&
    syntaxApi.isStringLiteralLike(node.argumentExpression)
  ) {
    return { receiver: node.expression, name: node.argumentExpression.text };
  }
  return undefined;
};

const cryptoKindOf = (imported: BuiltInImport): CryptoKind | undefined => {
  if (imported.kind === "module") return "node-module";
  if (imported.kind === "namespace") return "node-namespace";
  if (imported.name === "webcrypto") return "web-crypto";
  return CRYPTO_RANDOM_METHODS.has(imported.name) ? "random-function" : undefined;
};

const importedCryptoKindOf = (
  request: CallContext & { readonly node: SyntaxNode },
): CryptoKind | undefined => {
  const { syntaxApi, node, declarationsOf } = request;
  if (!syntaxApi.isIdentifier(node)) return undefined;
  const imported = builtInImportOf({
    syntaxApi,
    identifier: node,
    declarationsOf,
    builtIn: "crypto",
  });
  return imported === undefined ? undefined : cryptoKindOf(imported);
};

const qualifiedCryptoOf = (
  request: CallContext & { readonly receiver: SyntaxNode },
): CryptoReceiver | undefined => {
  const { syntaxApi, declarationsOf, receiver } = request;
  const member = memberOf({ syntaxApi, node: receiver });
  if (member === undefined) return undefined;
  if (member.name === "webcrypto" || member.name === "default") {
    const kind = cryptoReceiverOf({ ...request, receiver: member.receiver });
    if (member.name === "default") return kind === "node-namespace" ? "node-module" : undefined;
    return kind === "node-namespace" || kind === "node-module" ? "web-crypto" : undefined;
  }
  return member.name === "crypto" &&
    syntaxApi.isIdentifier(member.receiver) &&
    (member.receiver.text === "globalThis" || member.receiver.text === "window") &&
    declarationsOf(member.receiver).length === 0
    ? "web-crypto"
    : undefined;
};

const cryptoReceiverOf = (
  request: CallContext & { readonly receiver: SyntaxNode },
): CryptoReceiver | undefined => {
  const { syntaxApi, declarationsOf, receiver } = request;
  if (!syntaxApi.isIdentifier(receiver)) return qualifiedCryptoOf(request);
  if (receiver.text === "crypto" && declarationsOf(receiver).length === 0) return "web-crypto";
  const kind = importedCryptoKindOf({ ...request, node: receiver });
  return kind === "random-function" ? undefined : kind;
};

const randomCall = (
  request: CallContext & { readonly node: SyntaxNode },
): SyntaxNode | undefined => {
  const { syntaxApi, declarationsOf, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (syntaxApi.isIdentifier(callee)) {
    return importedCryptoKindOf({ ...request, node: callee }) === "random-function"
      ? callee
      : undefined;
  }
  const member = memberOf({ syntaxApi, node: callee });
  if (member === undefined) return undefined;
  const { receiver, name } = member;
  if (name === "random" && syntaxApi.isIdentifier(receiver) && receiver.text === "Math") {
    return declarationsOf(receiver).length === 0 ? callee : undefined;
  }
  return CRYPTO_RANDOM_METHODS.has(name) && cryptoReceiverOf({ ...request, receiver }) !== undefined
    ? callee
    : undefined;
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
              const declarationsOf = sourceValueLookupOf({ syntaxApi, sourceFile });
              return {
                enter: ({ node }) => {
                  const callee = randomCall({ syntaxApi, node, declarationsOf });
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
