import type {
  CallExpression,
  ExportDeclaration,
  ImportDeclaration,
  SyntaxNode,
  SyntaxTree,
  TypeScriptParsePort,
} from "../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";

export type ImportForm = "type-only" | "value" | "dynamic";

export type ModuleImport = {
  readonly specifier: string;
  readonly kind: "import" | "re-export" | "import-equals" | "import-type" | "load";
  readonly form: ImportForm;
  readonly names: readonly string[];
};

export type ReadModuleImports = (request: {
  readonly file: string;
  readonly text: string;
}) => readonly ModuleImport[];

type ParsedNode = {
  readonly parse: TypeScriptParsePort;
  readonly tree: SyntaxTree;
  readonly node: SyntaxNode;
};

type ImportClause = NonNullable<ImportDeclaration["importClause"]>;

type NamedElement = {
  readonly propertyName?: { readonly text: string } | undefined;
  readonly name: { readonly text: string };
};

const REQUIRE = "require";

const mapElementToName = (element: NamedElement): string =>
  (element.propertyName ?? element.name).text;

const mapExpressionToSpecifier = (
  request: Omit<ParsedNode, "node"> & { readonly expression: SyntaxNode },
): string =>
  request.parse.syntaxApi.isStringLiteralLike(request.expression)
    ? request.expression.text
    : request.expression.getText(request.tree);

const mapBindingsToNames = (
  request: Pick<ParsedNode, "parse"> & {
    readonly bindings: NonNullable<ImportClause["namedBindings"]>;
  },
): readonly string[] =>
  request.parse.syntaxApi.isNamespaceImport(request.bindings)
    ? [`* as ${request.bindings.name.text}`]
    : request.bindings.elements.map(mapElementToName);

const mapClauseToNames = (
  request: Pick<ParsedNode, "parse"> & { readonly clause: ImportClause },
): readonly string[] => {
  const { name, namedBindings } = request.clause;
  return [
    ...(name === undefined ? [] : [name.text]),
    ...(namedBindings === undefined
      ? []
      : mapBindingsToNames({ parse: request.parse, bindings: namedBindings })),
  ];
};

const mapExportToNames = (
  request: Pick<ParsedNode, "parse"> & { readonly declaration: ExportDeclaration },
): readonly string[] => {
  const { exportClause } = request.declaration;
  if (exportClause === undefined) {
    return ["*"];
  }
  return request.parse.syntaxApi.isNamespaceExport(exportClause)
    ? [`* as ${exportClause.name.text}`]
    : exportClause.elements.map(mapElementToName);
};

const readImportDeclaration = (request: ParsedNode): readonly ModuleImport[] => {
  const { parse, tree, node } = request;
  if (!parse.syntaxApi.isImportDeclaration(node)) {
    return [];
  }
  const clause = node.importClause;
  return [
    {
      specifier: mapExpressionToSpecifier({ parse, tree, expression: node.moduleSpecifier }),
      kind: "import",
      form: clause?.isTypeOnly === true ? "type-only" : "value",
      names: clause === undefined ? [] : mapClauseToNames({ parse, clause }),
    },
  ];
};

const readReExport = (request: ParsedNode): readonly ModuleImport[] => {
  const { parse, tree, node } = request;
  if (!parse.syntaxApi.isExportDeclaration(node) || node.moduleSpecifier === undefined) {
    return [];
  }
  return [
    {
      specifier: mapExpressionToSpecifier({ parse, tree, expression: node.moduleSpecifier }),
      kind: "re-export",
      form: node.isTypeOnly ? "type-only" : "value",
      names: mapExportToNames({ parse, declaration: node }),
    },
  ];
};

const readImportEquals = (request: ParsedNode): readonly ModuleImport[] => {
  const { parse, tree, node } = request;
  if (
    !parse.syntaxApi.isImportEqualsDeclaration(node) ||
    !parse.syntaxApi.isExternalModuleReference(node.moduleReference)
  ) {
    return [];
  }
  const { expression } = node.moduleReference;
  return [
    {
      specifier: mapExpressionToSpecifier({ parse, tree, expression }),
      kind: "import-equals",
      form: node.isTypeOnly ? "type-only" : "value",
      names: [node.name.text],
    },
  ];
};

const readImportType = (request: ParsedNode): readonly ModuleImport[] => {
  const { parse, tree, node } = request;
  if (!parse.syntaxApi.isImportTypeNode(node)) {
    return [];
  }
  const expression = parse.syntaxApi.isLiteralTypeNode(node.argument)
    ? node.argument.literal
    : node.argument;
  return [
    {
      specifier: mapExpressionToSpecifier({ parse, tree, expression }),
      kind: "import-type",
      form: "type-only",
      names: [],
    },
  ];
};

const listLoadedExpressions = (
  request: Pick<ParsedNode, "parse"> & { readonly call: CallExpression },
): readonly SyntaxNode[] => {
  const { syntaxApi } = request.parse;
  const callee = request.call.expression;
  const loads =
    callee.kind === syntaxApi.SyntaxKind.ImportKeyword ||
    (syntaxApi.isIdentifier(callee) && callee.text === REQUIRE);
  return loads ? request.call.arguments.slice(0, 1) : [];
};

const readLoad = (request: ParsedNode): readonly ModuleImport[] => {
  const { parse, tree, node } = request;
  if (!parse.syntaxApi.isCallExpression(node)) {
    return [];
  }
  return listLoadedExpressions({ parse, call: node }).map((expression) => ({
    specifier: mapExpressionToSpecifier({ parse, tree, expression }),
    kind: "load",
    form: "dynamic",
    names: [],
  }));
};

const IMPORT_READERS: readonly ((request: ParsedNode) => readonly ModuleImport[])[] = [
  readImportDeclaration,
  readReExport,
  readImportEquals,
  readImportType,
  readLoad,
];

const readImportsFrom = (request: ParsedNode): readonly ModuleImport[] => [
  ...IMPORT_READERS.flatMap((read) => read(request)),
  ...request.parse
    .children({ node: request.node })
    .flatMap((child) => readImportsFrom({ ...request, node: child })),
];

export const createModuleImportsReader =
  (options: { readonly parse: TypeScriptParsePort }): ReadModuleImports =>
  ({ file, text }) => {
    const tree = options.parse.parse({ fileName: file, source: text });
    return readImportsFrom({ parse: options.parse, tree, node: tree });
  };
