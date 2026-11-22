import { assert, describe, expect, it } from "vitest";
import type { Result } from "../../../src/domain/result.ts";
import type { ExportDeclaration, ImportDeclaration, Statement, SyntaxApi } from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import {
  type DeclarationEmit,
  type DeclarationFailure,
  type EmittedDeclaration,
  PUBLIC_TYPE_ENTRIES,
  type PublicTypeEntry,
  publishedDeclarationsOf,
  reachableDeclarations,
  typedExportOf,
} from "./package-declarations.ts";
import { createDefaultTypeScriptDeclarationPort } from "./typescript-declaration-port.ts";

type EntryReach = { readonly reached: readonly string[]; readonly packageImports: readonly string[] };

type PublicTypeReach = {
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

const valueClaimsIn = (request: { readonly syntaxApi: SyntaxApi; readonly text: string }): readonly string[] => {
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

const publicTypeReachOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly emitted: Result<DeclarationEmit, DeclarationFailure>;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach =>
  request.emitted.outcome === "failed"
    ? { problems: [request.emitted.error.detail], entries: {}, valueDeclaring: [], entryValues: {}, zodMentioning: [] }
    : reachOfEmit({ syntaxApi: request.syntaxApi, emit: request.emitted.value, entries: request.entries, requiredPeers: request.requiredPeers });

const ENTRY_SOURCES = ["src/audit.ts", "src/eslint-plugin.ts", "src/rule-set.ts", "src/testing.ts"];

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../..`, installForm: "source" }) });
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);

const reach = publicTypeReachOf({
  syntaxApi: loadedParsePort.value.syntaxApi,
  emitted: await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: `${import.meta.dirname}/../../..`, entryPoints: ENTRY_SOURCES }),
  entries: PUBLIC_TYPE_ENTRIES,
  requiredPeers: ["typescript"],
});

describe("publicTypeReachOf over a written-out emit, so the reach can fail", () => {
  const syntaxApi = loadedParsePort.value.syntaxApi;

  const EMIT: DeclarationEmit = {
    diagnostics: [],
    declarations: [
      { path: "api/audit.d.ts", text: 'export type { Tree } from "../core/tree.js";\n', specifiers: ["../core/tree.js"], refusals: [] },
      { path: "api/rule-set.d.ts", text: "export declare const ruleSet: 1;\n", specifiers: [], refusals: [] },
      { path: "core/tree.d.ts", text: 'import type typescript from "typescript";\nexport type Tree = typescript.Node;\nexport declare const tree: Tree;\n', specifiers: ["typescript"], refusals: [] },
      { path: "core/schema.d.ts", text: 'import { z } from "zod";\n', specifiers: ["zod"], refusals: [] },
    ],
  };

  it("names each entry's reached declarations and the packages they import, the values each entry declares, and the other shipped declarations that claim a value", () => {
    expect(
      publicTypeReachOf({
        syntaxApi,
        emitted: { outcome: "ok", value: EMIT },
        entries: [
          { subpath: "audit", source: "api/audit.ts" },
          { subpath: "rule-set", source: "api/rule-set.ts" },
        ],
        requiredPeers: ["typescript"],
      }),
    ).toEqual({
      problems: [],
      entries: {
        audit: { reached: ["api/audit.d.ts", "core/tree.d.ts"], packageImports: ["typescript"] },
        "rule-set": { reached: ["api/rule-set.d.ts"], packageImports: [] },
      },
      valueDeclaring: ["core/tree.d.ts: tree"],
      entryValues: { audit: [], "rule-set": ["ruleSet"] },
      zodMentioning: [],
    });
  });

  it("names a shipped declaration that mentions zod", () => {
    expect(
      publicTypeReachOf({
        syntaxApi,
        emitted: {
          outcome: "ok",
          value: { diagnostics: [], declarations: [{ path: "api/audit.d.ts", text: "export type Schema = 'zod';\n", specifiers: [], refusals: [] }] },
        },
        entries: [{ subpath: "audit", source: "api/audit.ts" }],
        requiredPeers: [],
      }).zodMentioning,
    ).toEqual(["api/audit.d.ts"]);
  });

  it("names the publication problems when a reached declaration imports a package that is not a required peer", () => {
    expect(
      publicTypeReachOf({
        syntaxApi,
        emitted: { outcome: "ok", value: EMIT },
        entries: [
          { subpath: "audit", source: "api/audit.ts" },
          { subpath: "rule-set", source: "api/rule-set.ts" },
        ],
        requiredPeers: [],
      }).problems,
    ).toEqual(["core/tree.d.ts imports typescript, which is neither shipped nor a required peer"]);
  });
});

describe("the declarations the public type entries ship, emitted in memory by the package build's own port (CD-47: nothing is spawned or written)", () => {
  it("emit every entry with no diagnostic and publish every declaration they reach", () => {
    expect(reach.problems).toEqual([]);
  });

  it("import no package but typescript from the audit entry, and none at all from the eslint-plugin, rule-set and testing entries", () => {
    expect(reach.entries).toMatchObject({
      audit: { packageImports: ["typescript"] },
      "eslint-plugin": { packageImports: [] },
      "rule-set": { packageImports: [] },
      testing: { packageImports: [] },
    });
  });

  it("reach from the eslint-plugin entry only its own declaration, which names its plugin type in its own words, never ESLint's", () => {
    expect(reach.entries).toMatchObject({ "eslint-plugin": { reached: ["src/eslint-plugin.d.ts"] } });
  });

  it("reach no internal port, toolchain or tool identity from the audit entry", () => {
    expect(reach.entries).toMatchObject({
      audit: {
        reached: expect.not.arrayContaining([
          expect.stringMatching(
            /^src\/(?:infrastructure\/engines\/protocol\/toolchain\/toolchain-requirement|domain\/runner\/runner-failure(?:-types)?|infrastructure\/node\/modules\/package-location-port|infrastructure\/node\/modules\/install-layout|domain\/rule-set\/tool-identity)\.d\.ts$/,
          ),
        ]),
      },
    });
  });

  it("ship no declaration but an entry's own that claims an exported value", () => {
    expect(reach.valueDeclaring).toEqual([]);
  });

  it("declare folderScope, editionReaches and isEdition from the audit entry, the three testing functions from the testing entry, only the default export from the eslint-plugin entry, and no named value from the rule-set entry", () => {
    expect(reach.entryValues).toEqual({ audit: ["folderScope", "editionReaches", "isEdition"], "eslint-plugin": ["export default plugin;"], "rule-set": [], testing: ["clauseConformanceOf", "clauseUnderTestOf", "repoPathOf", "checkUnderTestOf", "checkConformanceOf"] });
  });

  it("ship no declaration that mentions zod", () => {
    expect(reach.zodMentioning).toEqual([]);
  });
});
