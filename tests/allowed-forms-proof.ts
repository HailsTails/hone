import type { StandaloneRunner } from "../src/infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import type { RunnerClause } from "../src/application/ports/runner-module-types.ts";
import { createDefaultEntryKindPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../src/infrastructure/node/path-port.ts";
import type { SourceCase } from "../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import { createWalkerRunner } from "../src/infrastructure/engines/audit/runner/create-walker-runner.ts";
import type { CompilerOptions, SyntaxApi, TypeScriptParsePort } from "../src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts";
import type { AllowedFormSection } from "./allowed-forms-page.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";

export const repositoryRootOf = (request: { readonly testFolder: string }): string =>
  createDefaultPathPort({}).join({ segments: [request.testFolder, ".."] });

export const cd27ChecksPageOf = (request: { readonly repoRoot: string }): string => {
  const page = createDefaultFileTextPort({}).read({
    path: createDefaultPathPort({}).join({ segments: [request.repoRoot, "rules", "CD-27", "CHECKS.md"] }),
  });
  return page.outcome === "ok" ? page.value : "";
};

export const FORM_FILE = repoPathSchema.parse("allowed-form.test.ts");

export const VITEST_PRELUDE = "import { assert, expect, it, vi } from \"vitest\";\n";

const cd3CompilerOptionsOf = (request: { readonly syntaxApi: SyntaxApi }): CompilerOptions => ({
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noPropertyAccessFromIndexSignature: true,
  useUnknownInCatchVariables: true,
  target: request.syntaxApi.ScriptTarget.ESNext,
  module: request.syntaxApi.ModuleKind.ESNext,
  moduleResolution: request.syntaxApi.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  noEmit: true,
  types: [],
});

export type AllowedBlock = { readonly name: string; readonly source: string };

export const sectionNamesOf = (request: { readonly sections: readonly AllowedFormSection[] }): readonly string[] =>
  request.sections.map((section) => section.section);

export const allowedBlocksOf = (request: { readonly sections: readonly AllowedFormSection[] }): readonly AllowedBlock[] =>
  request.sections.flatMap((section) =>
    section.allowed.map((source, index) => ({ name: `${section.section} ${index + 1}`, source })),
  );

export const allowCasesOf = (request: { readonly blocks: readonly AllowedBlock[] }): readonly SourceCase[] =>
  request.blocks.map((block) => ({
    name: block.name,
    fileName: FORM_FILE,
    source: `${VITEST_PRELUDE}${block.source}`,
    expectedLines: [],
  }));

export const rowsNamed = <Row extends { readonly name: string }>(request: {
  readonly rows: readonly Row[];
  readonly names: readonly string[];
}): readonly Row[] => request.rows.filter((row) => request.names.includes(row.name));

export type BlockTypeErrors = { readonly name: string; readonly errors: readonly string[] };

export type FormDiagnostic = { readonly fileName: string | undefined; readonly message: string };

export type TypeErrors = { readonly blocks: readonly BlockTypeErrors[]; readonly unattributed: readonly string[] };

export const typeErrorsAmong = (request: {
  readonly forms: readonly { readonly name: string; readonly path: string }[];
  readonly diagnostics: readonly FormDiagnostic[];
}): TypeErrors => {
  const formPaths = request.forms.map((form) => form.path);
  return {
    blocks: request.forms.map((form) => ({
      name: form.name,
      errors: request.diagnostics.filter((diagnostic) => diagnostic.fileName === form.path).map((diagnostic) => diagnostic.message),
    })),
    unattributed: request.diagnostics
      .filter((diagnostic) => diagnostic.fileName === undefined || !formPaths.includes(diagnostic.fileName))
      .map((diagnostic) => (diagnostic.fileName === undefined ? diagnostic.message : `${diagnostic.fileName}: ${diagnostic.message}`)),
  };
};

export const typeErrorsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly repoRoot: string;
  readonly blocks: readonly AllowedBlock[];
}): TypeErrors => {
  const { syntaxApi } = request;
  const options = cd3CompilerOptionsOf({ syntaxApi });
  const root = request.repoRoot.replaceAll("\\", "/");
  const forms = request.blocks.map((block, index) => ({
    name: block.name,
    path: `${root}/allowed-form-${index}.test.ts`,
    text: `${VITEST_PRELUDE}${block.source}`,
  }));
  const formTextOf = (fileName: string): string | undefined =>
    forms.find((form) => form.path === fileName.replaceAll("\\", "/"))?.text;
  const host = syntaxApi.createCompilerHost(options);
  const readFile = host.readFile;
  const getSourceFile = host.getSourceFile;
  const program = syntaxApi.createProgram({
    rootNames: forms.map((form) => form.path),
    options,
    host: {
      ...host,
      fileExists: (fileName) => formTextOf(fileName) !== undefined || host.fileExists(fileName),
      readFile: (fileName) => formTextOf(fileName) ?? readFile(fileName),
      getSourceFile: (fileName, languageVersion) => {
        const text = formTextOf(fileName);
        return text === undefined ? getSourceFile(fileName, languageVersion) : syntaxApi.createSourceFile(fileName, text, languageVersion, true);
      },
    },
  });
  return typeErrorsAmong({
    forms,
    diagnostics: syntaxApi.getPreEmitDiagnostics(program).map((diagnostic) => ({
      fileName: diagnostic.file?.fileName.replaceAll("\\", "/"),
      message: syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    })),
  });
};

export const remedySectionsOf = async (request: {
  readonly repoRoot: string;
  readonly parse: TypeScriptParsePort;
  readonly clause: RunnerClause;
  readonly source: string;
}): Promise<readonly string[]> => {
  const path = createDefaultPathPort({});
  const repoRoot = absolutePathSchema.parse(request.repoRoot);
  const runner: StandaloneRunner = createWalkerRunner({
    fileText: overlaidFileText({
      base: createDefaultFileTextPort({}),
      files: { [path.join({ segments: [repoRoot, FORM_FILE] })]: `${VITEST_PRELUDE}${request.source}` },
    }),
    modules: createDefaultModuleLoaderPort({}),
    path,
    parse: request.parse,
    entryKind: createDefaultEntryKindPort({}),
  });
  const report = await runner.run({ repoRoot, installRoot: repoRoot, files: [FORM_FILE], trackedPaths: [FORM_FILE], clauses: [request.clause] });
  if (report.outcome === "failed") return [`run failed: ${report.error.kind}`];
  return report.value.hits.flatMap((hit) => (hit.remedy === undefined ? [] : [hit.remedy.section]));
};
