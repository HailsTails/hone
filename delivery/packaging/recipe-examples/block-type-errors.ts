import type {
  CompilerOptions,
  SyntaxApi,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import { createBlockText } from "./block-text.ts";
import type { BlockTypeError, TypeErrorsPort } from "./block-verdicts-port.ts";
import type { ExampleBlock } from "./example-block.ts";

type TypeErrorsSource = { readonly syntaxApi: SyntaxApi; readonly repoRoot: string };

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

type BlockFile = { readonly block: ExampleBlock; readonly path: string; readonly text: string };

const readTypeErrors = (
  request: TypeErrorsSource & { readonly blocks: readonly ExampleBlock[] },
): readonly BlockTypeError[] => {
  const { syntaxApi } = request;
  const options = createStrictOptions({ syntaxApi });
  const root = mapPathToSlashes({ path: request.repoRoot });
  const files = request.blocks.map((block, index): BlockFile => ({
    block,
    path: `${root}/recipe-example-${index}.test.ts`,
    text: createBlockText(block),
  }));
  const findFile = (path: string): BlockFile | undefined =>
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
  return syntaxApi.getPreEmitDiagnostics(program).map((diagnostic): BlockTypeError => {
    const message = syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const path = diagnostic.file?.fileName;
    const file = path === undefined ? undefined : findFile(path);
    if (file !== undefined) {
      return { kind: "in-a-block", block: file.block, message };
    }
    return {
      kind: "outside-the-blocks",
      message: path === undefined ? message : `${mapPathToSlashes({ path })}: ${message}`,
    };
  });
};

export const createTypeErrorsPort = (source: TypeErrorsSource): TypeErrorsPort => ({
  read: ({ blocks }) => readTypeErrors({ ...source, blocks }),
});
