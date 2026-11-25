import type {
  CompilerOptions,
  SyntaxApi,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import { type Diagnostic, mapDiagnosticsToTypeErrors } from "./block-diagnostics.ts";
import { createBlockText } from "./block-text.ts";
import type { BlockTypeError, TypeErrorsPort } from "./block-verdicts-port.ts";
import type { ExampleBlock } from "./example-block.ts";

type NamedText = { readonly path: string; readonly text: string };

export type Diagnose = (request: { readonly files: readonly NamedText[] }) => readonly Diagnostic[];

const createStrictOptions = (request: { readonly syntaxApi: SyntaxApi }): CompilerOptions => ({
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

const mapPathToSlashes = (request: { readonly path: string }): string =>
  request.path.replaceAll("\\", "/");

const readDiagnostics = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly files: readonly NamedText[];
}): readonly Diagnostic[] => {
  const { syntaxApi, files } = request;
  const options = createStrictOptions({ syntaxApi });
  const findFile = (path: string): NamedText | undefined =>
    files.find((file) => file.path === mapPathToSlashes({ path }));
  const host = syntaxApi.createCompilerHost(options);
  const { readFile, getSourceFile, fileExists } = host;
  const program = syntaxApi.createProgram({
    rootNames: files.map(({ path }) => path),
    options,
    host: {
      ...host,
      fileExists: (path) => findFile(path) !== undefined || fileExists(path),
      readFile: (path) => findFile(path)?.text ?? readFile(path),
      getSourceFile: (path, languageVersion) => {
        const file = findFile(path);
        return file === undefined
          ? getSourceFile(path, languageVersion)
          : syntaxApi.createSourceFile(path, file.text, languageVersion, true);
      },
    },
  });
  return syntaxApi.getPreEmitDiagnostics(program).map(({ file, messageText }) => ({
    path: file === undefined ? undefined : mapPathToSlashes({ path: file.fileName }),
    message: syntaxApi.flattenDiagnosticMessageText(messageText, "\n"),
  }));
};

const readTypeErrors = (request: {
  readonly diagnose: Diagnose;
  readonly repoRoot: string;
  readonly blocks: readonly ExampleBlock[];
}): readonly BlockTypeError[] => {
  const root = mapPathToSlashes({ path: request.repoRoot });
  const files = request.blocks.map((block, index) => ({
    block,
    path: `${root}/recipe-example-${index}.test.ts`,
  }));
  const diagnostics = request.diagnose({
    files: files.map(({ block, path }) => ({ path, text: createBlockText(block) })),
  });
  return mapDiagnosticsToTypeErrors({ files, diagnostics });
};

export const createTypeErrorsPort = (options: {
  readonly diagnose: Diagnose;
  readonly repoRoot: string;
}): TypeErrorsPort => ({
  read: ({ blocks }) => readTypeErrors({ ...options, blocks }),
});

export const createDefaultTypeErrorsPort = (options: {
  readonly syntaxApi: SyntaxApi;
  readonly repoRoot: string;
}): TypeErrorsPort =>
  createTypeErrorsPort({
    diagnose: ({ files }) => readDiagnostics({ syntaxApi: options.syntaxApi, files }),
    repoRoot: options.repoRoot,
  });
