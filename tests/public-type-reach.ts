import type { Result } from "../src/domain/result.ts";
import type { ExportDeclaration, ImportDeclaration, Statement, SyntaxApi } from "../src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts";
import {
  type DeclarationEmit,
  type DeclarationFailure,
  type EmittedDeclaration,
  type PublicTypeEntry,
  publishedDeclarationsOf,
  reachableDeclarations,
  typedExportOf,
} from "../delivery/packaging/type-declarations/package-declarations.ts";

export type EntryReach = { readonly reached: readonly string[]; readonly packageImports: readonly string[] };

export type PublicTypeReach = {
  readonly problems: readonly string[];
  readonly entries: Readonly<Record<string, EntryReach>>;
  readonly valueDeclaring: readonly string[];
  readonly entryValues: Readonly<Record<string, readonly string[]>>;
  readonly zodMentioning: readonly string[];
};

const RELATIVE_SPECIFIER = /^\.\.?\//;

const DECLARATION_FILE = /\.d\.ts$/;

type StatementRequest = { readonly syntaxApi: SyntaxApi; readonly statement: Statement };

const exportKeywordOf = (request: StatementRequest): "exported" | "local" =>
  request.syntaxApi.canHaveModifiers(request.statement) &&
  (request.syntaxApi.getModifiers(request.statement) ?? []).some((modifier) => modifier.kind === request.syntaxApi.SyntaxKind.ExportKeyword)
    ? "exported"
    : "local";

const importOnlyOf = (request: { readonly syntaxApi: SyntaxApi; readonly imported: ImportDeclaration }): "types" | "values" => {
  const clause = request.imported.importClause;
  const bindings = clause?.namedBindings;
  if (clause?.isTypeOnly) return "types";
  return clause !== undefined && clause.name === undefined && bindings !== undefined && request.syntaxApi.isNamedImports(bindings) && bindings.elements.every((element) => element.isTypeOnly)
    ? "types"
    : "values";
};

const typeNamesOf = (request: StatementRequest): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isTypeAliasDeclaration(statement) || syntaxApi.isInterfaceDeclaration(statement)) return [statement.name.text];
  if (!syntaxApi.isImportDeclaration(statement) || importOnlyOf({ syntaxApi, imported: statement }) === "values") return [];
  const bindings = statement.importClause?.namedBindings;
  if (bindings === undefined) return statement.importClause?.name === undefined ? [] : [statement.importClause.name.text];
  return syntaxApi.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : [bindings.name.text];
};

const exportedValueNamesOf = (request: StatementRequest): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (exportKeywordOf(request) === "local") return [];
  if (syntaxApi.isVariableStatement(statement)) return statement.declarationList.declarations.map((declaration) => declaration.name.getText());
  return (syntaxApi.isFunctionDeclaration(statement) || syntaxApi.isClassDeclaration(statement) || syntaxApi.isEnumDeclaration(statement)) && statement.name !== undefined
    ? [statement.name.text]
    : [];
};

const exportListClaims = (request: { readonly syntaxApi: SyntaxApi; readonly exported: ExportDeclaration; readonly typeNames: ReadonlySet<string> }): readonly string[] => {
  const clause = request.exported.exportClause;
  if (request.exported.isTypeOnly) return [];
  if (request.exported.moduleSpecifier !== undefined || clause === undefined || !request.syntaxApi.isNamedExports(clause)) return [request.exported.getText()];
  return clause.elements.filter((element) => !element.isTypeOnly && !request.typeNames.has((element.propertyName ?? element.name).text)).map((element) => element.getText());
};

const valueClaimsOf = (request: StatementRequest & { readonly typeNames: ReadonlySet<string> }): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isExportDeclaration(statement)) return exportListClaims({ syntaxApi, exported: statement, typeNames: request.typeNames });
  if (syntaxApi.isImportDeclaration(statement)) return importOnlyOf({ syntaxApi, imported: statement }) === "types" ? [] : [statement.getText()];
  if (syntaxApi.isTypeAliasDeclaration(statement) || syntaxApi.isInterfaceDeclaration(statement)) return [];
  if (syntaxApi.isVariableStatement(statement) || syntaxApi.isFunctionDeclaration(statement) || syntaxApi.isClassDeclaration(statement) || syntaxApi.isEnumDeclaration(statement)) {
    return exportedValueNamesOf(request);
  }
  return [statement.getText()];
};

export const valueClaimsIn = (request: { readonly syntaxApi: SyntaxApi; readonly text: string }): readonly string[] => {
  const sourceFile = request.syntaxApi.createSourceFile("shipped.d.ts", request.text, request.syntaxApi.ScriptTarget.Latest, true);
  const typeNames = new Set(sourceFile.statements.flatMap((statement) => typeNamesOf({ syntaxApi: request.syntaxApi, statement })));
  return sourceFile.statements.flatMap((statement) => valueClaimsOf({ syntaxApi: request.syntaxApi, statement, typeNames }));
};

const entryReachOf = (request: { readonly declarations: readonly EmittedDeclaration[]; readonly entry: PublicTypeEntry }): EntryReach => {
  const reached = reachableDeclarations({ declarations: request.declarations, roots: [typedExportOf({ entry: request.entry }).declaration] });
  const packageImports = request.declarations
    .filter((declaration) => reached.includes(declaration.path))
    .flatMap((declaration) => declaration.specifiers.filter((specifier) => !RELATIVE_SPECIFIER.test(specifier)));
  return { reached, packageImports: [...new Set(packageImports)].sort() };
};

const reachOfEmit = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly emit: DeclarationEmit;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach => {
  const published = publishedDeclarationsOf({ emit: request.emit, entries: request.entries, requiredPeers: request.requiredPeers });
  const shipped = published.outcome === "ok" ? published.value.filter((file) => DECLARATION_FILE.test(file.path)) : [];
  const entryDeclarations = new Set(request.entries.map((entry) => typedExportOf({ entry }).declaration));
  return {
    problems: published.outcome === "failed" ? published.error : [],
    entries: Object.fromEntries(request.entries.map((entry) => [entry.subpath, entryReachOf({ declarations: request.emit.declarations, entry })])),
    valueDeclaring: shipped.filter((file) => !entryDeclarations.has(file.path)).flatMap((file) => valueClaimsIn({ syntaxApi: request.syntaxApi, text: file.text }).map((claim) => `${file.path}: ${claim}`)),
    entryValues: Object.fromEntries(
      request.entries.map((entry) => [
        entry.subpath,
        valueClaimsIn({ syntaxApi: request.syntaxApi, text: shipped.find((file) => file.path === typedExportOf({ entry }).declaration)?.text ?? "" }),
      ]),
    ),
    zodMentioning: shipped.filter((file) => file.text.includes("zod")).map((file) => file.path),
  };
};

export const publicTypeReachOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly emitted: Result<DeclarationEmit, DeclarationFailure>;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach =>
  request.emitted.outcome === "failed"
    ? { problems: [request.emitted.error.detail], entries: {}, valueDeclaring: [], entryValues: {}, zodMentioning: [] }
    : reachOfEmit({ syntaxApi: request.syntaxApi, emit: request.emitted.value, entries: request.entries, requiredPeers: request.requiredPeers });
