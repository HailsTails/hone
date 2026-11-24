import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type {
  Identifier,
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
} from "../../runner/toolchain/typescript-parse.ts";

const ROW_TABLE_RECEIVERS: ReadonlySet<string> = new Set(["it", "describe"]);

const ROW_TABLE_METHOD = "each";

const READONLY_ARRAY = "ReadonlyArray";

type RowPart = "fits-a-row" | "breaks-a-row";

type RowUse = "row-table-argument" | "other-use";

type RowVerdict = "spared" | "flagged";

type RowTypes = {
  readonly syntaxApi: SyntaxApi;
  readonly importedNames: ReadonlySet<string>;
  readonly node: SyntaxNode;
};

const enclosingAugmentation = ({
  syntaxApi,
  node,
}: Pick<SyntaxVisit, "syntaxApi" | "node">): SyntaxNode | undefined => {
  const container = node.parent;
  if (syntaxApi.isSourceFile(container)) return undefined;
  if (
    syntaxApi.isModuleDeclaration(container) &&
    (syntaxApi.isStringLiteral(container.name) ||
      (container.flags & syntaxApi.NodeFlags.GlobalAugmentation) !== 0)
  )
    return container;
  return enclosingAugmentation({ syntaxApi, node: container });
};

const importedNamesOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
}): ReadonlySet<string> => {
  const { syntaxApi, sourceFile } = request;
  return new Set(
    sourceFile.statements.flatMap((statement) => {
      if (!syntaxApi.isImportDeclaration(statement) || statement.importClause === undefined)
        return [];
      const { name, namedBindings } = statement.importClause;
      const named =
        namedBindings === undefined || syntaxApi.isNamespaceImport(namedBindings)
          ? []
          : namedBindings.elements.map((element) => element.name.text);
      return name === undefined ? named : [name.text, ...named];
    }),
  );
};

const wholeRowPart = (parts: readonly RowPart[]): RowPart =>
  parts.length > 0 && parts.every((part) => part === "fits-a-row") ? "fits-a-row" : "breaks-a-row";

const primitiveKeywordPart = ({ syntaxApi, node }: RowTypes): RowPart => {
  const { SyntaxKind } = syntaxApi;
  return [
    SyntaxKind.StringKeyword,
    SyntaxKind.NumberKeyword,
    SyntaxKind.BooleanKeyword,
    SyntaxKind.BigIntKeyword,
    SyntaxKind.SymbolKeyword,
    SyntaxKind.UndefinedKeyword,
  ].includes(node.kind) ||
    (syntaxApi.isLiteralTypeNode(node) && node.literal.kind === SyntaxKind.NullKeyword)
    ? "fits-a-row"
    : "breaks-a-row";
};

const importedTypeReferencePart = (request: RowTypes): RowPart => {
  const { syntaxApi, importedNames, node } = request;
  return syntaxApi.isTypeReferenceNode(node) &&
    syntaxApi.isIdentifier(node.typeName) &&
    importedNames.has(node.typeName.text) &&
    (node.typeArguments ?? []).every(
      (argument) => rowMemberPart({ ...request, node: argument }) === "fits-a-row",
    )
    ? "fits-a-row"
    : "breaks-a-row";
};

const readonlyListPart = (request: RowTypes): RowPart => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isTypeOperatorNode(node))
    return node.operator === syntaxApi.SyntaxKind.ReadonlyKeyword &&
      syntaxApi.isArrayTypeNode(node.type)
      ? importedTypeReferencePart({ ...request, node: node.type.elementType })
      : "breaks-a-row";
  if (
    !syntaxApi.isTypeReferenceNode(node) ||
    !syntaxApi.isIdentifier(node.typeName) ||
    node.typeName.text !== READONLY_ARRAY
  )
    return "breaks-a-row";
  const [element, ...others] = node.typeArguments ?? [];
  return element !== undefined && others.length === 0
    ? importedTypeReferencePart({ ...request, node: element })
    : "breaks-a-row";
};

const rowMemberPart = (request: RowTypes): RowPart =>
  [importedTypeReferencePart, readonlyListPart, primitiveKeywordPart].some(
    (partOf) => partOf(request) === "fits-a-row",
  )
    ? "fits-a-row"
    : "breaks-a-row";

const objectMemberPart = (request: RowTypes): RowPart => {
  const { syntaxApi, node } = request;
  return syntaxApi.isPropertySignature(node) &&
    node.type !== undefined &&
    node.questionToken === undefined
    ? rowMemberPart({ ...request, node: node.type })
    : "breaks-a-row";
};

const tupleElementPart = (request: RowTypes): RowPart => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isNamedTupleMember(node)) return rowMemberPart(request);
  return node.dotDotDotToken === undefined && node.questionToken === undefined
    ? rowMemberPart({ ...request, node: node.type })
    : "breaks-a-row";
};

const tupleRowPart = (request: RowTypes): RowPart => {
  const { syntaxApi, node } = request;
  return syntaxApi.isTupleTypeNode(node)
    ? wholeRowPart(node.elements.map((element) => tupleElementPart({ ...request, node: element })))
    : "breaks-a-row";
};

const rowShapePart = (request: RowTypes): RowPart => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isTypeOperatorNode(node))
    return node.operator === syntaxApi.SyntaxKind.ReadonlyKeyword
      ? tupleRowPart({ ...request, node: node.type })
      : "breaks-a-row";
  if (syntaxApi.isTypeLiteralNode(node))
    return wholeRowPart(
      node.members.map((member) => objectMemberPart({ ...request, node: member })),
    );
  return tupleRowPart(request);
};

const rowUseOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly identifier: Identifier;
}): RowUse => {
  const { syntaxApi, identifier } = request;
  const reference = identifier.parent;
  if (!syntaxApi.isTypeReferenceNode(reference) || reference.typeArguments !== undefined)
    return "other-use";
  const call = reference.parent;
  return syntaxApi.isCallExpression(call) &&
    call.typeArguments?.length === 1 &&
    call.typeArguments.includes(reference) &&
    syntaxApi.isPropertyAccessExpression(call.expression) &&
    syntaxApi.isIdentifier(call.expression.expression) &&
    ROW_TABLE_RECEIVERS.has(call.expression.expression.text) &&
    call.expression.name.text === ROW_TABLE_METHOD
    ? "row-table-argument"
    : "other-use";
};

const useIn = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
  readonly declared: Identifier;
  readonly use: RowUse;
}): RowUse | undefined => {
  const { syntaxApi, declared, use } = request;
  return syntaxApi.forEachChild(request.node, (child) =>
    syntaxApi.isIdentifier(child) &&
    child !== declared &&
    child.text === declared.text &&
    rowUseOf({ syntaxApi, identifier: child }) === use
      ? use
      : useIn({ ...request, node: child }),
  );
};

const rowVerdictOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
  readonly node: SyntaxNode;
  readonly readImportedNames: () => ReadonlySet<string>;
}): RowVerdict => {
  const { syntaxApi, sourceFile, node } = request;
  if (
    !syntaxApi.isTypeAliasDeclaration(node) ||
    node.parent !== sourceFile ||
    node.typeParameters !== undefined ||
    node.modifiers?.some((modifier) => modifier.kind === syntaxApi.SyntaxKind.ExportKeyword) ===
      true ||
    rowShapePart({ syntaxApi, importedNames: request.readImportedNames(), node: node.type }) ===
      "breaks-a-row"
  )
    return "flagged";
  const uses = { syntaxApi, node: sourceFile, declared: node.name };
  return useIn({ ...uses, use: "other-use" }) === undefined &&
    useIn({ ...uses, use: "row-table-argument" }) !== undefined
    ? "spared"
    : "flagged";
};

export const check: WalkerPiece = {
  prepare: (request) => {
    const importedNames = new WeakMap<SyntaxTree, ReadonlySet<string>>();
    const importedNamesIn = (
      visit: Pick<SyntaxVisit, "syntaxApi" | "sourceFile">,
    ): ReadonlySet<string> => {
      const known = importedNames.get(visit.sourceFile);
      if (known !== undefined) return known;
      const names = importedNamesOf(visit);
      importedNames.set(visit.sourceFile, names);
      return names;
    };
    return syntaxNodeCheck({
      eligibility: testFileEligibility,
      found: ({ syntaxApi, node, sourceFile }) => {
        if (
          !syntaxApi.isTypeAliasDeclaration(node) &&
          !syntaxApi.isInterfaceDeclaration(node) &&
          !syntaxApi.isEnumDeclaration(node)
        )
          return undefined;
        if (enclosingAugmentation({ syntaxApi, node }) !== undefined) return undefined;
        const verdict = rowVerdictOf({
          syntaxApi,
          sourceFile,
          node,
          readImportedNames: () => importedNamesIn({ syntaxApi, sourceFile }),
        });
        if (verdict === "spared") return undefined;
        return { at: node, snippet: node.name.getText(sourceFile) };
      },
    }).prepare(request);
  },
};
