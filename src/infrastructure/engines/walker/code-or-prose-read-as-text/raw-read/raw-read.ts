import { sourceBindingsOf } from "../../runner/pieces/source-bindings.ts";
import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";
import { withoutParentheses } from "../../runner/pieces/syntax-parentheses.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type {
  SyntaxNode,
  SyntaxTree,
  TypeChecker,
} from "../../runner/toolchain/typescript-parse.ts";

const TEXT_TYPES = new Set(["ts", "tsx", "mts", "cts", "md", "mdx"]);
const PATH_BUILDERS = new Set(["join", "resolve", "normalize", "fileURLToPath"]);
const FILE_READS = new Set(["readFile", "readFileSync"]);
const FILE_SYSTEM_MODULES = new Set(["fs", "fs/promises", "node:fs", "node:fs/promises"]);

type SoughtLiteral = Pick<SyntaxVisit, "syntaxApi" | "node"> & {
  readonly accepts: (text: string) => boolean;
};

const literalIn = ({ syntaxApi, node, accepts }: SoughtLiteral): SyntaxNode | undefined => {
  if (syntaxApi.isStringLiteralLike(node)) return accepts(node.text) ? node : undefined;
  if (!syntaxApi.isTemplateExpression(node)) return undefined;
  const tail = node.templateSpans.at(-1)?.literal.text;
  return tail !== undefined && accepts(tail) ? node : undefined;
};

const textPath = (path: string): boolean => {
  const extension = /\.([^./?]+)$/u.exec(path)?.[1];
  return extension !== undefined && TEXT_TYPES.has(extension.toLowerCase());
};

const textGlob = (path: string): boolean => {
  if (path.startsWith("!")) return false;
  const alternatives = /\.\{([^}]+)\}$/u.exec(path)?.[1];
  return (
    textPath(path) ||
    (alternatives?.split(",").some((extension) => TEXT_TYPES.has(extension.toLowerCase())) ?? false)
  );
};

const rawQuery = (query: string): boolean => query.replace(/^\?/u, "").split("&").includes("raw");

const rawModule = (path: string): boolean => {
  const queryStart = path.indexOf("?");
  return queryStart >= 0 && textPath(path.slice(0, queryStart)) && rawQuery(path.slice(queryStart));
};

type SyntaxSite = Pick<SyntaxVisit, "syntaxApi" | "node">;

const memberNameOf = ({ syntaxApi, node }: SyntaxSite): string | undefined => {
  if (syntaxApi.isIdentifier(node) || syntaxApi.isStringLiteralLike(node)) return node.text;
  return syntaxApi.isPropertyAccessExpression(node) ? node.name.text : undefined;
};

const rawOptions = ({ syntaxApi, node }: SyntaxSite): boolean =>
  syntaxApi.isObjectLiteralExpression(node) &&
  node.properties.some((property) => {
    if (!syntaxApi.isPropertyAssignment(property)) return false;
    const name = memberNameOf({ syntaxApi, node: property.name });
    if (name === "query")
      return (
        syntaxApi.isStringLiteralLike(property.initializer) && rawQuery(property.initializer.text)
      );
    return (
      name === "as" &&
      syntaxApi.isStringLiteralLike(property.initializer) &&
      property.initializer.text === "raw"
    );
  });

const filePathOf = (request: SyntaxSite): SyntaxNode | undefined => {
  const { syntaxApi } = request;
  const node = withoutParentheses(request);
  if (
    syntaxApi.isAsExpression(node) ||
    syntaxApi.isTypeAssertionExpression(node) ||
    syntaxApi.isNonNullExpression(node)
  )
    return filePathOf({ syntaxApi, node: node.expression });
  const literal = literalIn({ syntaxApi, node, accepts: textPath });
  if (literal !== undefined) return literal;
  if (
    syntaxApi.isNewExpression(node) &&
    syntaxApi.isIdentifier(node.expression) &&
    node.expression.text === "URL"
  ) {
    const path = node.arguments?.[0];
    return path === undefined ? undefined : filePathOf({ syntaxApi, node: path });
  }
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const builder = memberNameOf({ syntaxApi, node: node.expression });
  if (builder === undefined || !PATH_BUILDERS.has(builder)) return undefined;
  const path =
    builder === "join" || builder === "resolve" ? node.arguments.at(-1) : node.arguments[0];
  return path === undefined ? undefined : filePathOf({ syntaxApi, node: path });
};

const fileSystemImportNameOf = ({ syntaxApi, node }: SyntaxSite): string | undefined => {
  if (syntaxApi.isImportSpecifier(node) && node.isTypeOnly) return undefined;
  const binding = syntaxApi.isImportSpecifier(node) ? node.parent : node;
  const clause =
    syntaxApi.isNamedImports(binding) || syntaxApi.isNamespaceImport(binding)
      ? binding.parent
      : binding;
  if (!syntaxApi.isImportClause(clause) || clause.isTypeOnly) return undefined;
  const declaration = clause.parent;
  if (!syntaxApi.isImportDeclaration(declaration)) return undefined;
  const module = declaration.moduleSpecifier;
  if (!syntaxApi.isStringLiteral(module) || !FILE_SYSTEM_MODULES.has(module.text)) return undefined;
  return syntaxApi.isImportSpecifier(node) ? (node.propertyName ?? node.name).text : "module";
};

const fileReadCallee = (
  request: SyntaxSite & { readonly checker: () => TypeChecker },
): SyntaxNode | undefined => {
  const { syntaxApi, node, checker } = request;
  const name = memberNameOf(request);
  if (name === undefined || !FILE_READS.has(name)) return undefined;
  if (syntaxApi.isIdentifier(node)) {
    const declarations = checker().getSymbolAtLocation(node)?.declarations ?? [];
    return declarations.length === 0 ||
      declarations.some(
        (declaration) => fileSystemImportNameOf({ syntaxApi, node: declaration }) === name,
      )
      ? node
      : undefined;
  }
  if (!syntaxApi.isPropertyAccessExpression(node)) return undefined;
  const owner = node.expression;
  const receiver =
    syntaxApi.isPropertyAccessExpression(owner) && owner.name.text === "promises"
      ? owner.expression
      : owner;
  if (!syntaxApi.isIdentifier(receiver)) return undefined;
  const declarations = checker().getSymbolAtLocation(receiver)?.declarations ?? [];
  if (declarations.length === 0) return receiver.text === "fs" ? node : undefined;
  return declarations.some(
    (declaration) => fileSystemImportNameOf({ syntaxApi, node: declaration }) === "module",
  )
    ? node
    : undefined;
};

const rawGlobPathOf = (request: SyntaxVisit): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const { expression, arguments: callArguments } = node;
  if (
    syntaxApi.isPropertyAccessExpression(expression) &&
    expression.name.text === "glob" &&
    syntaxApi.isMetaProperty(expression.expression) &&
    expression.expression.keywordToken === syntaxApi.SyntaxKind.ImportKeyword &&
    expression.expression.name.text === "meta"
  ) {
    const [pattern, options] = callArguments;
    if (
      pattern !== undefined &&
      options !== undefined &&
      rawOptions({ syntaxApi, node: options })
    ) {
      const patterns = syntaxApi.isArrayLiteralExpression(pattern) ? pattern.elements : [pattern];
      return patterns
        .map((element) => literalIn({ syntaxApi, node: element, accepts: textGlob }))
        .find((path) => path !== undefined);
    }
  }
  return undefined;
};

const readPathOf = (
  request: SyntaxVisit & { readonly checker: () => TypeChecker },
): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isImportDeclaration(node))
    return node.importClause?.isTypeOnly === true
      ? undefined
      : literalIn({ syntaxApi, node: node.moduleSpecifier, accepts: rawModule });
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const [path] = node.arguments;
  if (path === undefined) return undefined;
  if (node.expression.kind === syntaxApi.SyntaxKind.ImportKeyword)
    return literalIn({ syntaxApi, node: path, accepts: rawModule });
  if (fileReadCallee({ ...request, node: node.expression }) !== undefined)
    return filePathOf({ syntaxApi, node: path });
  return rawGlobPathOf(request);
};

export const check: WalkerPiece = {
  prepare: (request) => {
    const bindings = new WeakMap<SyntaxTree, TypeChecker>();
    return syntaxNodeCheck({
      eligibility: testFileEligibility,
      found: (visit) => {
        const checker = (): TypeChecker => {
          const previous = bindings.get(visit.sourceFile);
          if (previous !== undefined) return previous;
          const bound = sourceBindingsOf(visit);
          bindings.set(visit.sourceFile, bound);
          return bound;
        };
        const at = readPathOf({ ...visit, checker });
        return at === undefined ? undefined : { at, snippet: at.getText(visit.sourceFile) };
      },
    }).prepare(request);
  },
};
