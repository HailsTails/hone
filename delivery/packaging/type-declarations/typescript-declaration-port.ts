import type { Result } from "../../../src/domain/result.ts";
import type { RunnerFailure } from "../../../src/domain/runner/runner-failure.ts";
import type {
  CompilerOptions,
  CustomTransformers,
  Diagnostic,
  ExportAssignment,
  ExportDeclaration,
  ImportDeclaration,
  Statement,
  SyntaxApi,
  SyntaxNode,
  TypeScriptParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import type {
  DeclarationEmit,
  DeclarationFailure,
  DeclarationPort,
  EmittedDeclaration,
} from "./package-declarations.ts";

type DeclarationTransformerFactory = NonNullable<CustomTransformers["afterDeclarations"]>[number];
type ParsePortLoader = (request: {
  readonly installRoot: string;
}) => Promise<Result<TypeScriptParsePort, RunnerFailure>>;

type Emitted = Result<DeclarationEmit, DeclarationFailure>;

const PROJECT_CONFIG = "tsconfig.json";

const SOURCE_SPECIFIER = /^(\.\.?\/.*)\.ts$/;

const DECLARATION_FILE = /\.d\.ts$/;

const SOURCE_FILE = /\.ts$/;

const DECLARATION_SUFFIX = ".d.ts";

const declarationsFailed = (request: { readonly detail: string }): Emitted => ({
  outcome: "failed",
  error: { kind: "declarations-failed", detail: request.detail },
});

const repositoryRootOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceRoot: string;
}): string => `${request.syntaxApi.sys.resolvePath(request.sourceRoot).replaceAll("\\", "/")}/`;

const repositoryPathOf = (request: { readonly root: string; readonly fileName: string }): string =>
  request.fileName.replaceAll("\\", "/").replace(request.root, "");

const publishedSpecifier = (request: { readonly specifier: string }): string =>
  request.specifier.replace(SOURCE_SPECIFIER, "$1.js");

type StatementPublication =
  | { readonly kind: "kept"; readonly statement: Statement }
  | { readonly kind: "dropped" }
  | { readonly kind: "refused"; readonly detail: string };

type FileBindings = {
  readonly types: ReadonlySet<string>;
  readonly privateValues: ReadonlySet<string>;
};

export type DeclarationRole = "entry" | "internal";

type StatementRequest = { readonly syntaxApi: SyntaxApi; readonly statement: Statement };

type PublicationRequest = StatementRequest & {
  readonly bindings: FileBindings;
  readonly role: DeclarationRole;
};

const ONLY_TYPES =
  "a shipped declaration may hold only type declarations, type-only imports and type-only exports";

const refused = (request: { readonly reason: string }): StatementPublication => ({
  kind: "refused",
  detail: `${request.reason}; ${ONLY_TYPES}`,
});

const visibilityOf = (request: StatementRequest): "exported" | "local" =>
  request.syntaxApi.canHaveModifiers(request.statement) &&
  (request.syntaxApi.getModifiers(request.statement) ?? []).some(
    (modifier) => modifier.kind === request.syntaxApi.SyntaxKind.ExportKeyword,
  )
    ? "exported"
    : "local";

const valueDeclarationNames = (request: StatementRequest): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      syntaxApi.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }
  if (
    syntaxApi.isFunctionDeclaration(statement) ||
    syntaxApi.isClassDeclaration(statement) ||
    syntaxApi.isEnumDeclaration(statement)
  ) {
    return statement.name === undefined ? [] : [statement.name.text];
  }
  return [];
};

const natureOf = (request: StatementRequest): "value" | "other" =>
  request.syntaxApi.isVariableStatement(request.statement) ||
  request.syntaxApi.isFunctionDeclaration(request.statement) ||
  request.syntaxApi.isClassDeclaration(request.statement) ||
  request.syntaxApi.isEnumDeclaration(request.statement)
    ? "value"
    : "other";

const importKindOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly imported: ImportDeclaration;
}): "type-only" | "value" => {
  const clause = request.imported.importClause;
  if (clause === undefined) return "value";
  if (clause.isTypeOnly) return "type-only";
  const bindings = clause.namedBindings;
  return clause.name === undefined &&
    bindings !== undefined &&
    request.syntaxApi.isNamedImports(bindings) &&
    bindings.elements.every((element) => element.isTypeOnly)
    ? "type-only"
    : "value";
};

const importedNames = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly imported: ImportDeclaration;
}): readonly string[] => {
  const clause = request.imported.importClause;
  const bindings = clause?.namedBindings;
  const named =
    bindings === undefined
      ? []
      : request.syntaxApi.isNamedImports(bindings)
        ? bindings.elements.map((element) => element.name.text)
        : [bindings.name.text];
  return [...(clause?.name === undefined ? [] : [clause.name.text]), ...named];
};

const typeNamesOf = (request: StatementRequest): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isTypeAliasDeclaration(statement) || syntaxApi.isInterfaceDeclaration(statement)) {
    return [statement.name.text];
  }
  return syntaxApi.isImportDeclaration(statement) &&
    importKindOf({ syntaxApi, imported: statement }) === "type-only"
    ? importedNames({ syntaxApi, imported: statement })
    : [];
};

const bindingsIn = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly statements: readonly Statement[];
}): FileBindings => ({
  types: new Set(
    request.statements.flatMap((statement) =>
      typeNamesOf({ syntaxApi: request.syntaxApi, statement }),
    ),
  ),
  privateValues: new Set(
    request.statements
      .filter((statement) => visibilityOf({ syntaxApi: request.syntaxApi, statement }) === "local")
      .flatMap((statement) => valueDeclarationNames({ syntaxApi: request.syntaxApi, statement })),
  ),
});

const localExportPublication = (
  request: PublicationRequest & { readonly exported: ExportDeclaration },
): StatementPublication => {
  const syntaxApi = request.syntaxApi;
  const clause = request.exported.exportClause;
  if (clause === undefined || !syntaxApi.isNamedExports(clause)) {
    return refused({ reason: "an export without a list" });
  }
  const localName = (element: (typeof clause.elements)[number]): string =>
    (element.propertyName ?? element.name).text;
  const unknown = clause.elements.find(
    (element) =>
      !element.isTypeOnly &&
      !request.bindings.types.has(localName(element)) &&
      !request.bindings.privateValues.has(localName(element)),
  );
  if (unknown !== undefined) {
    return refused({
      reason: `"${localName(unknown)}" is exported but is not a type declared or imported as a type here`,
    });
  }
  const typeElements = clause.elements.filter(
    (element) => element.isTypeOnly || request.bindings.types.has(localName(element)),
  );
  if (typeElements.length === clause.elements.length) {
    return { kind: "kept", statement: request.statement };
  }
  return typeElements.length === 0
    ? { kind: "dropped" }
    : {
        kind: "kept",
        statement: syntaxApi.factory.updateExportDeclaration(
          request.exported,
          request.exported.modifiers,
          false,
          syntaxApi.factory.updateNamedExports(clause, typeElements),
          undefined,
          request.exported.attributes,
        ),
      };
};

const exportDeclarationPublication = (
  request: PublicationRequest & { readonly exported: ExportDeclaration },
): StatementPublication => {
  if (request.exported.isTypeOnly) {
    return { kind: "kept", statement: request.statement };
  }
  const specifier = request.exported.moduleSpecifier;
  if (specifier !== undefined) {
    return refused({
      reason: `a value re-export from ${request.syntaxApi.isStringLiteral(specifier) ? specifier.text : "another module"}`,
    });
  }
  return localExportPublication(request);
};

const otherStatementPublication = (request: StatementRequest): StatementPublication => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isModuleDeclaration(statement)) {
    return refused({ reason: `the module declaration "${statement.name.text}"` });
  }
  if (syntaxApi.isImportEqualsDeclaration(statement)) {
    return refused({ reason: `the import-equals "${statement.name.text}"` });
  }
  if (syntaxApi.isNamespaceExportDeclaration(statement)) {
    return refused({ reason: `"export as namespace ${statement.name.text}"` });
  }
  return refused({ reason: `a statement of kind ${statement.kind}` });
};

const exportAssignmentPublication = (
  request: PublicationRequest & { readonly assigned: ExportAssignment },
): StatementPublication => {
  const { syntaxApi, assigned } = request;
  const namesPrivateValue =
    assigned.isExportEquals !== true &&
    syntaxApi.isIdentifier(assigned.expression) &&
    request.bindings.privateValues.has(assigned.expression.text);
  return request.role === "entry" && namesPrivateValue
    ? { kind: "kept", statement: assigned }
    : { kind: "dropped" };
};

const statementPublication = (request: PublicationRequest): StatementPublication => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isExportDeclaration(statement)) {
    return exportDeclarationPublication({ ...request, exported: statement });
  }
  if (syntaxApi.isImportDeclaration(statement)) {
    return importKindOf({ syntaxApi, imported: statement }) === "type-only"
      ? { kind: "kept", statement }
      : refused({
          reason: `a value import from ${syntaxApi.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : "another module"}`,
        });
  }
  if (syntaxApi.isTypeAliasDeclaration(statement) || syntaxApi.isInterfaceDeclaration(statement)) {
    return { kind: "kept", statement };
  }
  if (natureOf(request) === "value") {
    return visibilityOf(request) === "exported" && request.role === "internal"
      ? { kind: "dropped" }
      : { kind: "kept", statement };
  }
  if (syntaxApi.isExportAssignment(statement)) {
    return exportAssignmentPublication({ ...request, assigned: statement });
  }
  return otherStatementPublication(request);
};
const publishedLiteral = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode =>
  request.syntaxApi.isStringLiteral(request.node) && SOURCE_SPECIFIER.test(request.node.text)
    ? request.syntaxApi.factory.createStringLiteral(
        publishedSpecifier({ specifier: request.node.text }),
      )
    : request.node;

const publishedImportType = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode =>
  request.syntaxApi.isLiteralTypeNode(request.node) &&
  request.syntaxApi.isStringLiteral(request.node.literal)
    ? request.syntaxApi.factory.createLiteralTypeNode(
        request.syntaxApi.factory.createStringLiteral(
          publishedSpecifier({ specifier: request.node.literal.text }),
        ),
      )
    : request.node;

const moduleSyntaxOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly statement: Statement;
}): "module-syntax" | "other" =>
  request.syntaxApi.isImportDeclaration(request.statement) ||
  request.syntaxApi.isExportDeclaration(request.statement) ||
  request.syntaxApi.isExportAssignment(request.statement) ||
  visibilityOf(request) === "exported"
    ? "module-syntax"
    : "other";

const moduleMarkerFor = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly original: readonly Statement[];
  readonly kept: readonly Statement[];
}): readonly Statement[] => {
  const marks = (statements: readonly Statement[]): "module" | "script" =>
    statements.some(
      (statement) =>
        moduleSyntaxOf({ syntaxApi: request.syntaxApi, statement }) === "module-syntax",
    )
      ? "module"
      : "script";
  return marks(request.original) === "module" && marks(request.kept) === "script"
    ? [
        request.syntaxApi.factory.createExportDeclaration(
          undefined,
          false,
          request.syntaxApi.factory.createNamedExports([]),
        ),
      ]
    : [];
};

export type PublishedDeclarationText = {
  readonly text: string;
  readonly refusals: readonly string[];
};

export const publishedDeclarationText = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly path: string;
  readonly text: string;
  readonly role: DeclarationRole;
}): PublishedDeclarationText => {
  const syntaxApi = request.syntaxApi;
  const sourceFile = syntaxApi.createSourceFile(
    request.path,
    request.text,
    syntaxApi.ScriptTarget.Latest,
    true,
  );
  const bindings = bindingsIn({ syntaxApi, statements: sourceFile.statements });
  const publications = sourceFile.statements.map((statement) =>
    statementPublication({ syntaxApi, statement, bindings, role: request.role }),
  );
  const kept = publications.flatMap((publication) =>
    publication.kind === "kept" ? [publication.statement] : [],
  );
  return {
    text: syntaxApi
      .createPrinter({ newLine: syntaxApi.NewLineKind.LineFeed })
      .printFile(
        syntaxApi.factory.updateSourceFile(sourceFile, [
          ...kept,
          ...moduleMarkerFor({ syntaxApi, original: sourceFile.statements, kept }),
        ]),
      ),
    refusals: publications.flatMap((publication) =>
      publication.kind === "refused" ? [`${request.path}: ${publication.detail}`] : [],
    ),
  };
};

const specifierTransformer =
  (request: { readonly syntaxApi: SyntaxApi }): DeclarationTransformerFactory =>
  (context) => {
    const syntaxApi = request.syntaxApi;
    const visit = (node: SyntaxNode): SyntaxNode => {
      if (syntaxApi.isImportDeclaration(node) || syntaxApi.isExportDeclaration(node)) {
        return syntaxApi.visitEachChild(
          node,
          (child) =>
            child === node.moduleSpecifier
              ? publishedLiteral({ syntaxApi, node: child })
              : visit(child),
          context,
        );
      }
      if (syntaxApi.isImportTypeNode(node)) {
        return syntaxApi.visitEachChild(
          node,
          (child) =>
            child === node.argument
              ? publishedImportType({ syntaxApi, node: child })
              : visit(child),
          context,
        );
      }
      return syntaxApi.visitEachChild(node, visit, context);
    };
    return (root) => syntaxApi.visitEachChild(root, visit, context);
  };

const diagnosticText = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly root: string;
  readonly diagnostic: Diagnostic;
}): string => {
  const message = request.syntaxApi.flattenDiagnosticMessageText(
    request.diagnostic.messageText,
    " ",
  );
  return request.diagnostic.file === undefined
    ? message
    : `${repositoryPathOf({ root: request.root, fileName: request.diagnostic.file.fileName })}: ${message}`;
};

const specifiersIn = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly text: string;
}): readonly string[] => {
  const scanned = request.syntaxApi.preProcessFile(request.text, true, true);
  return [...scanned.importedFiles, ...scanned.typeReferenceDirectives].map(
    (reference) => reference.fileName,
  );
};

const projectOptionsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly root: string;
}): Result<CompilerOptions, string> => {
  const syntaxApi = request.syntaxApi;
  const read = syntaxApi.readConfigFile(`${request.root}${PROJECT_CONFIG}`, syntaxApi.sys.readFile);
  if (read.error !== undefined) {
    return {
      outcome: "failed",
      error: syntaxApi.flattenDiagnosticMessageText(read.error.messageText, " "),
    };
  }
  const parsed = syntaxApi.parseJsonConfigFileContent(read.config, syntaxApi.sys, request.root);
  return {
    outcome: "ok",
    value: { ...parsed.options, noEmit: false, declaration: true, emitDeclarationOnly: true },
  };
};

const emittedWith = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly root: string;
  readonly options: CompilerOptions;
  readonly entryPoints: readonly string[];
}): DeclarationEmit => {
  const syntaxApi = request.syntaxApi;
  const written = new Map<string, string>();
  const host = syntaxApi.createCompilerHost(request.options);
  const program = syntaxApi.createProgram({
    rootNames: request.entryPoints.map((entryPoint) => `${request.root}${entryPoint}`),
    options: request.options,
    host: {
      ...host,
      writeFile: (fileName, text) => {
        written.set(repositoryPathOf({ root: request.root, fileName }), text);
      },
    },
  });
  const emitted = program.emit(undefined, undefined, undefined, true, {
    afterDeclarations: [specifierTransformer({ syntaxApi })],
  });
  const entryDeclarations = new Set(
    request.entryPoints.map((entryPoint) => entryPoint.replace(SOURCE_FILE, DECLARATION_SUFFIX)),
  );
  const published = [...written]
    .filter(([path]) => DECLARATION_FILE.test(path))
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([path, text]) => ({
      path,
      publication: publishedDeclarationText({
        syntaxApi,
        path,
        text,
        role: entryDeclarations.has(path) ? "entry" : "internal",
      }),
    }));
  return {
    declarations: published.map(({ path, publication }): EmittedDeclaration => ({
      path,
      text: publication.text,
      specifiers: specifiersIn({ syntaxApi, text: publication.text }),
      refusals: publication.refusals,
    })),
    diagnostics: [...syntaxApi.getPreEmitDiagnostics(program), ...emitted.diagnostics].map(
      (diagnostic) => diagnosticText({ syntaxApi, root: request.root, diagnostic }),
    ),
  };
};

const emittedBy = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceRoot: string;
  readonly entryPoints: readonly string[];
}): Emitted => {
  const root = repositoryRootOf(request);
  const options = projectOptionsOf({ syntaxApi: request.syntaxApi, root });
  return options.outcome === "failed"
    ? declarationsFailed({ detail: `read ${PROJECT_CONFIG}: ${options.error}` })
    : {
        outcome: "ok",
        value: emittedWith({
          syntaxApi: request.syntaxApi,
          root,
          options: options.value,
          entryPoints: request.entryPoints,
        }),
      };
};

export const createTypeScriptDeclarationPort = (options: {
  readonly load: ParsePortLoader;
}): DeclarationPort => ({
  emit: async (request) => {
    const parsePort = await options.load({ installRoot: request.sourceRoot });
    return parsePort.outcome === "failed"
      ? declarationsFailed({ detail: `load typescript: ${parsePort.error.kind}` })
      : emittedBy({
          syntaxApi: parsePort.value.syntaxApi,
          sourceRoot: request.sourceRoot,
          entryPoints: request.entryPoints,
        });
  },
});

export const createDefaultTypeScriptDeclarationPort = (
  _options: Record<string, never>,
): DeclarationPort =>
  createTypeScriptDeclarationPort({
    load: (request) =>
      loadParsePort({
        peers: defaultTypeScriptPeers({ installRoot: request.installRoot, installForm: "source" }),
      }),
  });
