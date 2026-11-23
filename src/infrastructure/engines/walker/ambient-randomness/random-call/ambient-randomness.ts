import { sourceValueLookupOf } from "../../runner/pieces/source-bindings.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";

const SOURCE_ENDINGS = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_ENDINGS = [".d.ts", ".d.mts", ".d.cts"];
const CRYPTO_RANDOM_METHODS = new Set(["randomUUID", "getRandomValues"]);

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };
type DeclarationsOf = (node: SyntaxNode) => readonly SyntaxNode[];
type CryptoKind = "node-module" | "node-namespace" | "web-crypto" | "random-function";
type CryptoBinding = { readonly declaration: SyntaxNode; readonly kind: CryptoKind };
type CryptoEntry = readonly [name: string, binding: CryptoBinding];
type CryptoBindings = ReadonlyMap<string, CryptoBinding>;
type CallContext = {
  readonly syntaxApi: SyntaxApi;
  readonly declarationsOf: DeclarationsOf;
  readonly cryptoBindings: CryptoBindings;
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

const CRYPTO_MODULES: ReadonlySet<string> = new Set(["node:crypto", "crypto"]);

const cryptoKindOf = (name: string): CryptoKind | undefined => {
  if (name === "webcrypto") return "web-crypto";
  if (name === "default") return "node-module";
  return CRYPTO_RANDOM_METHODS.has(name) ? "random-function" : undefined;
};

const cryptoImportsOf = ({ syntaxApi, node }: SyntaxRequest): readonly CryptoEntry[] => {
  if (syntaxApi.isImportEqualsDeclaration(node)) {
    if (node.isTypeOnly || !syntaxApi.isExternalModuleReference(node.moduleReference)) return [];
    const { expression } = node.moduleReference;
    return expression !== undefined &&
      syntaxApi.isStringLiteral(expression) &&
      CRYPTO_MODULES.has(expression.text)
      ? [[node.name.text, { declaration: node, kind: "node-module" }]]
      : [];
  }
  if (!syntaxApi.isImportDeclaration(node)) return [];
  const { importClause, moduleSpecifier } = node;
  if (
    importClause === undefined ||
    importClause.isTypeOnly ||
    !syntaxApi.isStringLiteral(moduleSpecifier) ||
    !CRYPTO_MODULES.has(moduleSpecifier.text)
  )
    return [];

  const defaultEntry: readonly CryptoEntry[] =
    importClause.name === undefined
      ? []
      : [[importClause.name.text, { declaration: importClause, kind: "node-module" }]];
  const { namedBindings } = importClause;
  if (namedBindings === undefined) return defaultEntry;
  if (syntaxApi.isNamespaceImport(namedBindings))
    return [
      ...defaultEntry,
      [namedBindings.name.text, { declaration: namedBindings, kind: "node-namespace" }],
    ];
  return [
    ...defaultEntry,
    ...namedBindings.elements.flatMap<CryptoEntry>((declaration) => {
      if (declaration.isTypeOnly) return [];
      const kind = cryptoKindOf((declaration.propertyName ?? declaration.name).text);
      return kind === undefined ? [] : [[declaration.name.text, { declaration, kind }]];
    }),
  ];
};

const cryptoBindingsOf = ({
  syntaxApi,
  sourceFile,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
}): CryptoBindings =>
  new Map(sourceFile.statements.flatMap((node) => cryptoImportsOf({ syntaxApi, node })));

const importedCryptoKindOf = (
  request: CallContext & { readonly node: SyntaxNode },
): CryptoKind | undefined => {
  const { syntaxApi, node, declarationsOf, cryptoBindings } = request;
  if (!syntaxApi.isIdentifier(node)) return undefined;
  const binding = cryptoBindings.get(node.text);
  return binding !== undefined && declarationsOf(node).includes(binding.declaration)
    ? binding.kind
    : undefined;
};

const qualifiedCrypto = (request: CallContext & { readonly receiver: SyntaxNode }): boolean => {
  const { syntaxApi, declarationsOf, receiver } = request;
  const member = memberOf({ syntaxApi, node: receiver });
  if (member === undefined || !syntaxApi.isIdentifier(member.receiver)) return false;
  if (member.name === "webcrypto" || member.name === "default") {
    const kind = importedCryptoKindOf({ ...request, node: member.receiver });
    return kind === "node-namespace" || (member.name === "webcrypto" && kind === "node-module");
  }
  return (
    member.name === "crypto" &&
    (member.receiver.text === "globalThis" || member.receiver.text === "window") &&
    declarationsOf(member.receiver).length === 0
  );
};

const cryptoReceiver = (request: CallContext & { readonly receiver: SyntaxNode }): boolean => {
  const { syntaxApi, declarationsOf, receiver } = request;
  if (!syntaxApi.isIdentifier(receiver)) return qualifiedCrypto(request);
  if (receiver.text === "crypto" && declarationsOf(receiver).length === 0) return true;
  const kind = importedCryptoKindOf({ ...request, node: receiver });
  return kind === "node-module" || kind === "node-namespace" || kind === "web-crypto";
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
  return CRYPTO_RANDOM_METHODS.has(name) && cryptoReceiver({ ...request, receiver })
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
              const cryptoBindings = cryptoBindingsOf({ syntaxApi, sourceFile });
              const declarationsOf = sourceValueLookupOf({ syntaxApi, sourceFile });
              return {
                enter: ({ node }) => {
                  const callee = randomCall({ syntaxApi, node, declarationsOf, cryptoBindings });
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
