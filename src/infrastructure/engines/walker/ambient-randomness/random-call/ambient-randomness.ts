import { runtimeDeclarationsOf, sourceBindingsOf } from "../../runner/pieces/source-bindings.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type {
  SyntaxApi,
  SyntaxNode,
  TypeChecker,
} from "../../runner/toolchain/typescript-parse.ts";

const SOURCE_ENDINGS = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_ENDINGS = [".d.ts", ".d.mts", ".d.cts"];
const CRYPTO_RANDOM_METHODS = new Set(["randomUUID", "getRandomValues"]);

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };
type DeclarationsOf = (node: SyntaxNode) => readonly SyntaxNode[];
type CallContext = {
  readonly syntaxApi: SyntaxApi;
  readonly declarationsOf: DeclarationsOf;
  readonly hasCryptoImport: boolean;
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

const cryptoModuleName = (specifier: string): boolean =>
  specifier === "node:crypto" || specifier === "crypto";

const nodeCryptoImport = ({ syntaxApi, node }: SyntaxRequest): boolean => {
  if (syntaxApi.isImportDeclaration(node)) {
    return (
      syntaxApi.isStringLiteral(node.moduleSpecifier) &&
      cryptoModuleName(node.moduleSpecifier.text) &&
      node.importClause?.isTypeOnly !== true
    );
  }
  if (
    !syntaxApi.isImportEqualsDeclaration(node) ||
    node.isTypeOnly ||
    !syntaxApi.isExternalModuleReference(node.moduleReference)
  )
    return false;
  const specifier = node.moduleReference.expression;
  return (
    specifier !== undefined &&
    syntaxApi.isStringLiteral(specifier) &&
    cryptoModuleName(specifier.text)
  );
};

const comesFromNodeCrypto = ({ syntaxApi, node }: SyntaxRequest): boolean => {
  if (syntaxApi.isImportDeclaration(node) || syntaxApi.isImportEqualsDeclaration(node))
    return nodeCryptoImport({ syntaxApi, node });
  return (
    node.parent !== undefined &&
    !syntaxApi.isSourceFile(node) &&
    comesFromNodeCrypto({ syntaxApi, node: node.parent })
  );
};

const nodeCryptoBindingOf = (
  request: SyntaxRequest,
): "node-module" | "web-crypto" | "random-function" | "other" => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isImportSpecifier(node)) {
    if (node.isTypeOnly || !comesFromNodeCrypto(request)) return "other";
    const importedName = (node.propertyName ?? node.name).text;
    if (importedName === "webcrypto") return "web-crypto";
    if (importedName === "default") return "node-module";
    return CRYPTO_RANDOM_METHODS.has(importedName) ? "random-function" : "other";
  }
  if (
    (syntaxApi.isNamespaceImport(node) ||
      syntaxApi.isImportClause(node) ||
      syntaxApi.isImportEqualsDeclaration(node)) &&
    comesFromNodeCrypto(request)
  ) {
    return "node-module";
  }
  return "other";
};

const qualifiedCrypto = (request: CallContext & { readonly receiver: SyntaxNode }): boolean => {
  const { syntaxApi, declarationsOf, receiver, hasCryptoImport } = request;
  const member = memberOf({ syntaxApi, node: receiver });
  if (member === undefined || !syntaxApi.isIdentifier(member.receiver)) return false;
  if (member.name === "webcrypto" && hasCryptoImport) {
    return declarationsOf(member.receiver).some(
      (node) => nodeCryptoBindingOf({ syntaxApi, node }) === "node-module",
    );
  }
  return (
    member.name === "crypto" &&
    (member.receiver.text === "globalThis" || member.receiver.text === "window") &&
    declarationsOf(member.receiver).length === 0
  );
};

const cryptoReceiver = (request: CallContext & { readonly receiver: SyntaxNode }): boolean => {
  const { syntaxApi, declarationsOf, receiver, hasCryptoImport } = request;
  if (!syntaxApi.isIdentifier(receiver)) return qualifiedCrypto(request);
  if (receiver.text !== "crypto" && !hasCryptoImport) return false;
  const declarations = declarationsOf(receiver);
  return (
    (receiver.text === "crypto" && declarations.length === 0) ||
    declarations.some((node) => {
      const kind = nodeCryptoBindingOf({ syntaxApi, node });
      return kind === "node-module" || kind === "web-crypto";
    })
  );
};

const randomCall = (
  request: CallContext & { readonly node: SyntaxNode },
): SyntaxNode | undefined => {
  const { syntaxApi, declarationsOf, node, hasCryptoImport } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (syntaxApi.isIdentifier(callee)) {
    return hasCryptoImport &&
      declarationsOf(callee).some(
        (node) => nodeCryptoBindingOf({ syntaxApi, node }) === "random-function",
      )
      ? callee
      : undefined;
  }
  const member = memberOf({ syntaxApi, node: callee });
  if (member === undefined) return undefined;
  const { receiver, name } = member;
  if (name === "random" && syntaxApi.isIdentifier(receiver) && receiver.text === "Math") {
    return declarationsOf(receiver).length === 0 ? callee : undefined;
  }
  return CRYPTO_RANDOM_METHODS.has(name) &&
    cryptoReceiver({ syntaxApi, declarationsOf, receiver, hasCryptoImport })
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
              const hasCryptoImport = sourceFile.statements.some((node) =>
                nodeCryptoImport({ syntaxApi, node }),
              );
              let bindingsInSource: TypeChecker | undefined;
              const declarationsOf: DeclarationsOf = (node) => {
                bindingsInSource ??= sourceBindingsOf({ syntaxApi, sourceFile });
                const found = bindingsInSource.getSymbolAtLocation(node);
                return runtimeDeclarationsOf({
                  syntaxApi,
                  declarations: found?.declarations ?? [],
                });
              };
              return {
                enter: ({ node }) => {
                  const callee = randomCall({ syntaxApi, node, declarationsOf, hasCryptoImport });
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
