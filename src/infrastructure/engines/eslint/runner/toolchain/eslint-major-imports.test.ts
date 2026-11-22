import { assert, describe, expect, it } from "vitest";
import type { ExportDeclaration, ImportDeclaration, SyntaxNode, SyntaxTree } from "../../../walker/runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../../walker/runner/toolchain/typescript-toolchain.ts";
import { projectionOutputNamesOf, projectionOutputsOf } from "../../../../../domain/repository/projection-outputs.ts";
import { installedEslintBoundary } from "./eslint-toolchain.ts";

const installedBoundary = await installedEslintBoundary();

if (installedBoundary.outcome === "failed") {
  throw new Error(installedBoundary.error);
}

const INSTALLED_DECLARATION_TEXT: string = installedBoundary.value.declarationText;

const ESLINT_ENGINE_NAME = "eslint";

const REPOSITORY_ROOT = ".";

const keyIn = (request: { readonly folder: string; readonly name: string }): string => `${request.folder}/${request.name}`;

const ROOT_PROJECTION_DECLARATION_KEY: string = keyIn({ folder: REPOSITORY_ROOT, name: projectionOutputsOf({ engineName: ESLINT_ENGINE_NAME }).declaration });

const projectionDeclarationKeyIn = (request: { readonly folder: string }): string =>
  keyIn({ folder: `${REPOSITORY_ROOT}/${request.folder}`, name: projectionOutputsOf({ engineName: ESLINT_ENGINE_NAME }).declaration });

const WRITTEN_AT_THE_ROOT: readonly string[] = projectionOutputNamesOf({ engineNames: [ESLINT_ENGINE_NAME] }).map((name) =>
  keyIn({ folder: REPOSITORY_ROOT, name }),
);

const withoutProjectionOutputs = (request: { readonly sources: Readonly<Record<string, string>> }): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([file]) => !WRITTEN_AT_THE_ROOT.includes(file)));

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" }) });

assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");

assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);

const syntaxApi = loadedParsePort.value.syntaxApi;

type ImportForm = "type-only" | "value" | "dynamic";

type ModuleImport = { readonly specifier: string; readonly form: ImportForm };

type SourceText = { readonly file: string; readonly text: string };

type NodeIn = { readonly node: SyntaxNode; readonly sourceFile: SyntaxTree };

const sourceFileOf = (request: SourceText): SyntaxTree =>
  syntaxApi.createSourceFile(request.file, request.text, syntaxApi.ScriptTarget.Latest, true);

const specifierOf = (request: { readonly expression: SyntaxNode; readonly sourceFile: SyntaxTree }): string =>
  syntaxApi.isStringLiteralLike(request.expression)
    ? request.expression.text
    : request.expression.getText(request.sourceFile);

const declarationImportOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  if (syntaxApi.isImportDeclaration(node)) {
    return { specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }), form: node.importClause?.isTypeOnly === true ? "type-only" : "value" };
  }
  if (syntaxApi.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
    return { specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }), form: node.isTypeOnly ? "type-only" : "value" };
  }
  return undefined;
};

const importEqualsOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  return syntaxApi.isImportEqualsDeclaration(node) && syntaxApi.isExternalModuleReference(node.moduleReference)
    ? { specifier: specifierOf({ expression: node.moduleReference.expression, sourceFile }), form: node.isTypeOnly ? "type-only" : "value" }
    : undefined;
};

const importTypeOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  if (!syntaxApi.isImportTypeNode(node)) {
    return undefined;
  }
  const named = syntaxApi.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument;
  return { specifier: specifierOf({ expression: named, sourceFile }), form: "type-only" };
};

const loadedArgumentOf = (request: NodeIn): SyntaxNode | undefined => {
  const { node } = request;
  if (!syntaxApi.isCallExpression(node)) {
    return undefined;
  }
  const callee = node.expression;
  return callee.kind === syntaxApi.SyntaxKind.ImportKeyword || (syntaxApi.isIdentifier(callee) && callee.text === "require") ? node.arguments[0] : undefined;
};

const loadCallOf = (request: NodeIn): ModuleImport | undefined => {
  const loaded = loadedArgumentOf(request);
  return loaded === undefined ? undefined : { specifier: specifierOf({ expression: loaded, sourceFile: request.sourceFile }), form: "dynamic" };
};

const ownImportOf = (request: NodeIn): ModuleImport | undefined =>
  declarationImportOf(request) ?? importEqualsOf(request) ?? importTypeOf(request) ?? loadCallOf(request);

const childrenOf = (request: { readonly node: SyntaxNode }): readonly SyntaxNode[] => {
  const children: SyntaxNode[] = [];
  syntaxApi.forEachChild(request.node, (child) => {
    children.push(child);
  });
  return children;
};

const importsBelow = (request: NodeIn): readonly ModuleImport[] => {
  const own = ownImportOf(request);
  return [...(own === undefined ? [] : [own]), ...childrenOf(request).flatMap((child) => importsBelow({ node: child, sourceFile: request.sourceFile }))];
};

const importsIn = (request: SourceText): readonly ModuleImport[] => {
  const sourceFile = sourceFileOf(request);
  return importsBelow({ node: sourceFile, sourceFile });
};

type ModuleStatementKind = "import" | "re-export";

type ImportFactsIn = {
  readonly specifier: string;
  readonly kind: ModuleStatementKind;
  readonly form: Exclude<ImportForm, "dynamic">;
  readonly names: readonly string[];
};

type ImportClause = NonNullable<ImportDeclaration["importClause"]>;

const importClauseNamesOf = (request: { readonly clause: ImportClause }): readonly string[] => {
  const defaultNames = request.clause.name === undefined ? [] : [request.clause.name.text];
  const bound = request.clause.namedBindings;
  if (bound === undefined) {
    return defaultNames;
  }
  const namedNames = syntaxApi.isNamespaceImport(bound)
    ? [`* as ${bound.name.text}`]
    : bound.elements.map((element) => (element.propertyName ?? element.name).text);
  return [...defaultNames, ...namedNames];
};

const exportNamesOf = (request: { readonly declaration: ExportDeclaration }): readonly string[] => {
  const exported = request.declaration.exportClause;
  if (exported === undefined) {
    return ["*"];
  }
  return syntaxApi.isNamespaceExport(exported)
    ? [`* as ${exported.name.text}`]
    : exported.elements.map((element) => (element.propertyName ?? element.name).text);
};

const statementFactsOf = (request: NodeIn): ImportFactsIn | undefined => {
  const { node, sourceFile } = request;
  if (syntaxApi.isImportDeclaration(node) && node.importClause !== undefined) {
    return {
      specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }),
      kind: "import",
      form: node.importClause.isTypeOnly ? "type-only" : "value",
      names: importClauseNamesOf({ clause: node.importClause }),
    };
  }
  if (syntaxApi.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
    return {
      specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }),
      kind: "re-export",
      form: node.isTypeOnly ? "type-only" : "value",
      names: exportNamesOf({ declaration: node }),
    };
  }
  return undefined;
};

const importFactsIn = (request: SourceText): readonly ImportFactsIn[] => {
  const sourceFile = sourceFileOf(request);
  return sourceFile.statements.flatMap((statement) => {
    const facts = statementFactsOf({ node: statement, sourceFile });
    return facts === undefined ? [] : [facts];
  });
};

type ConfinementVerdict = "allowed" | "outside";

type ImportAllowance = (request: { readonly moduleImport: ModuleImport }) => ConfinementVerdict;

type ImportOutside = ModuleImport & { readonly file: string };

const STATIC_FORMS: readonly ModuleImport["form"][] = ["value", "type-only"];

const importNotMatching =
  (request: { readonly specifier: RegExp }): ImportAllowance =>
  ({ moduleImport }) =>
    request.specifier.test(moduleImport.specifier) ? "outside" : "allowed";

const allowanceOf = (request: {
  readonly allowed: readonly ImportAllowance[];
  readonly moduleImport: ModuleImport;
}): ConfinementVerdict =>
  request.allowed.some((allows) => allows({ moduleImport: request.moduleImport }) === "allowed") ? "allowed" : "outside";

const importsOutside = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowed: readonly ImportAllowance[];
}): readonly ImportOutside[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsIn({ file, text })
      .filter((moduleImport) => allowanceOf({ allowed: request.allowed, moduleImport }) === "outside")
      .map((moduleImport) => ({ file, ...moduleImport })),
  );

type ImportFacts = ImportFactsIn & { readonly file: string };

const importFactsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ImportFacts[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importFactsIn({ file, text })
      .filter((facts) => request.specifier.test(facts.specifier))
      .map((facts) => ({ file, ...facts })),
  );

type UnfactedImports = {
  readonly file: string;
  readonly specifier: string;
  readonly found: number;
  readonly withFacts: number;
};

const importsWithoutFacts = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly UnfactedImports[] => {
  const facts = importFactsReaching(request);
  return Object.entries(request.sources).flatMap(([file, text]) => {
    const found = importsIn({ file, text }).filter(
      (moduleImport) => STATIC_FORMS.includes(moduleImport.form) && request.specifier.test(moduleImport.specifier),
    );
    return [...new Set(found.map(({ specifier }) => specifier))].flatMap((specifier) => {
      const foundCount = found.filter((moduleImport) => moduleImport.specifier === specifier).length;
      const withFacts = facts.filter((fact) => fact.file === file && fact.specifier === specifier).length;
      return foundCount === withFacts ? [] : [{ file, specifier, found: foundCount, withFacts }];
    });
  });
};

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ESLINT_MAJOR_SPECIFIER = /^eslint(?:-9)?(?:\/|$)/;

const notAnEslintMajor: ImportAllowance = importNotMatching({ specifier: ESLINT_MAJOR_SPECIFIER });

const loadedOutsideTheBoundaries = import.meta.glob(
  [
    "./**/*.{ts,mts,cts,js,mjs,cjs}",
    "!./node_modules/**",
    "!./.claude/**",
    "!./artefacts/**",
    "!./delivery/install-proof/consumer-proof/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary*.ts",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-10/**",
  ],
  { base: "../../../../../../", query: "?raw", import: "default", eager: true },
);

const outsideTheBoundaries = withoutProjectionOutputs({ sources: loadedOutsideTheBoundaries });

const NESTED_DECLARATION_KEY = projectionDeclarationKeyIn({ folder: "src/infrastructure/engines/eslint/runner" });

const UPGRADED_TREE: Readonly<Record<string, string>> = {
  [ROOT_PROJECTION_DECLARATION_KEY]: INSTALLED_DECLARATION_TEXT,
  [NESTED_DECLARATION_KEY]: INSTALLED_DECLARATION_TEXT,
};

const insideTheBoundaries = import.meta.glob(
  [
    "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary.ts",
    "./src/infrastructure/engines/eslint/runner/toolchain/eslint-10/*.ts",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-*/*.test.ts",
  ],
  { base: "../../../../../../", query: "?raw", import: "default", eager: true },
);

describe("the ESLint import reading over written-out sources, so each guard can fail", () => {
  it("lists an import of eslint or eslint-9 of any form, by file and form", () => {
    expect(
      importsOutside({
        sources: { "./a.ts": 'import type { Rule } from "eslint";\nimport { z } from "zod";\nconst loaded = await import("eslint-9/use-at-your-own-risk");\n' },
        allowed: [notAnEslintMajor],
      }),
    ).toEqual([
      { file: "./a.ts", specifier: "eslint", form: "type-only" },
      { file: "./a.ts", specifier: "eslint-9/use-at-your-own-risk", form: "dynamic" },
    ]);
  });

  it("lists a static import of eslint or eslint-9 that the facts do not hold, with how many were found and held", () => {
    expect(
      importsWithoutFacts({
        sources: { "./a.ts": 'import { ESLint } from "eslint";\nimport "eslint-9/side-effect";\n' },
        specifier: ESLINT_MAJOR_SPECIFIER,
      }),
    ).toEqual([{ file: "./a.ts", specifier: "eslint-9/side-effect", found: 1, withFacts: 0 }]);
  });
});

describe("where ESLint is imported, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it)", () => {
  it("reads a known file from each scanned set, so no scan is silently empty", () => {
    expect([outsideTheBoundaries, insideTheBoundaries]).toEqual([
      expect.objectContaining({ "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts": expect.any(String) }),
      expect.objectContaining({
        "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-boundary.ts": expect.any(String),
        "./src/infrastructure/engines/eslint/runner/toolchain/eslint-10/eslint-10-boundary.ts": expect.any(String),
      }),
    ]);
  });

  it("finds neither boundary importing ESLint itself, each taking its major through the Rule type the common side names", () => {
    expect(importsOutside({ sources: insideTheBoundaries, allowed: [notAnEslintMajor] })).toEqual([]);
  });

  it("finds every static import and re-export of eslint or eslint-9 outside the two boundaries, by file, specifier, form and names, a list that can only shrink", () => {
    expect(importFactsReaching({ sources: outsideTheBoundaries, specifier: ESLINT_MAJOR_SPECIFIER })).toEqual([
      { file: "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts", kind: "import", specifier: "eslint", form: "type-only", names: ["ESLint", "Rule"] },
      { file: "./src/infrastructure/engines/eslint/runner/pieces/native-rules.ts", kind: "import", specifier: "eslint/use-at-your-own-risk", form: "value", names: ["builtinRules"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", kind: "import", specifier: "eslint-9", form: "value", names: ["ESLint"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", kind: "import", specifier: "eslint-9/use-at-your-own-risk", form: "value", names: ["builtinRules"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", kind: "import", specifier: "eslint", form: "type-only", names: ["ESLint"] },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", kind: "re-export", specifier: "eslint", form: "type-only", names: ["AST", "Rule", "SourceCode"] },
    ]);
  });

  it("finds the root declaration hone project writes importing eslint when nothing is left out, and a declaration of that name in a folder too", () => {
    expect(importsOutside({ sources: UPGRADED_TREE, allowed: [notAnEslintMajor] })).toEqual([
      { file: ROOT_PROJECTION_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
      { file: NESTED_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
    ]);
  });

  it("finds only the declaration of that name in a folder, once the root declaration hone project writes is left out", () => {
    expect(importsOutside({ sources: withoutProjectionOutputs({ sources: UPGRADED_TREE }), allowed: [notAnEslintMajor] })).toEqual([
      { file: NESTED_DECLARATION_KEY, specifier: "eslint", form: "type-only" },
    ]);
  });

  it("finds no static import or re-export of eslint or eslint-9 outside the two boundaries that the facts above fail to hold", () => {
    expect(importsWithoutFacts({ sources: outsideTheBoundaries, specifier: ESLINT_MAJOR_SPECIFIER })).toEqual([]);
  });

  it("finds every import of eslint or eslint-9 of any form outside the two boundaries, the dynamic loads and the one re-export included, by file and form", () => {
    expect(importsOutside({ sources: outsideTheBoundaries, allowed: [notAnEslintMajor] })).toEqual([
      { file: "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts", specifier: "eslint", form: "type-only" },
      { file: "./src/infrastructure/engines/eslint/runner/pieces/native-rules.ts", specifier: "eslint/use-at-your-own-risk", form: "value" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", specifier: "eslint-9", form: "value" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts", specifier: "eslint-9/use-at-your-own-risk", form: "value" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", specifier: "eslint", form: "type-only" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts", specifier: "eslint", form: "type-only" },
      { file: "./src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts", specifier: "eslint", form: "dynamic" },
    ]);
  });
});
