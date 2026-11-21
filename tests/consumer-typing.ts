import { createDefaultTypeScriptDeclarationPort } from "../delivery/packaging/type-declarations/typescript-declaration-port.ts";
import type { CompilerOptions, Diagnostic } from "../src/infrastructure/engines/audit/runner/toolchain/typescript-parse.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

export type EslintLine = "eslint" | "eslint-9";

export const ESLINT_LINES: readonly EslintLine[] = ["eslint", "eslint-9"];

export type Resolution = "bundler" | "nodenext";

export const RESOLUTIONS: readonly Resolution[] = ["bundler", "nodenext"];

export type ConsumerForm = "typescript" | "checked-javascript";

export type ConsumerFiles = Readonly<Record<string, string>>;

export type ConsumerDiagnostic = { readonly file: string; readonly code: number; readonly message: string };

const syntaxApi = defaultParsePort.syntaxApi;

const SLASH = "/";

const BACKSLASH = String.fromCharCode(92);

const NEW_LINE = "\n";

const ROOT = syntaxApi.sys.resolvePath(`${import.meta.dirname}/..`).replaceAll(BACKSLASH, SLASH);

const CONSUMER_ROOT = `${ROOT}/.consumer`;

const MODULES = `${CONSUMER_ROOT}/node_modules`;

const INSTALLED_ESLINT = `${MODULES}/eslint`;

const INSTALLED_HONE = `${MODULES}/@hailstails/hone`;

const PLUGIN_ENTRY = "src/eslint-plugin.ts";

const CONSUMER_PACKAGE = JSON.stringify({ name: "consumer", type: "module" });

const HONE_PACKAGE = JSON.stringify({ name: "@hailstails/hone", type: "module", exports: { "./eslint-plugin": { types: "./src/eslint-plugin.d.ts" } } });

const emitted = await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: ROOT, entryPoints: [PLUGIN_ENTRY] });

const shippedFiles: ReadonlyMap<string, string> = new Map(
  emitted.outcome === "ok" ? emitted.value.declarations.map((declaration) => [`${INSTALLED_HONE}/${declaration.path}`, declaration.text]) : [],
);

export const shippedDeclarationDiagnostics: readonly string[] = emitted.outcome === "ok" ? emitted.value.diagnostics : [emitted.error.detail];

const optionsOn = (request: { readonly resolution: Resolution; readonly form: ConsumerForm }): CompilerOptions => ({
  strict: true,
  noEmit: true,
  skipLibCheck: false,
  target: syntaxApi.ScriptTarget.ESNext,
  module: request.resolution === "nodenext" ? syntaxApi.ModuleKind.NodeNext : syntaxApi.ModuleKind.ESNext,
  moduleResolution: request.resolution === "nodenext" ? syntaxApi.ModuleResolutionKind.NodeNext : syntaxApi.ModuleResolutionKind.Bundler,
  types: [],
  allowJs: request.form === "checked-javascript",
  checkJs: request.form === "checked-javascript",
});

type Consumer = {
  readonly line: EslintLine;
  readonly files: ConsumerFiles;
};

const memoryFilesOf = (request: Consumer): ReadonlyMap<string, string> =>
  new Map([
    [`${CONSUMER_ROOT}/package.json`, CONSUMER_PACKAGE],
    ...Object.entries(request.files).map(([file, text]): [string, string] => [`${CONSUMER_ROOT}/${file}`, text]),
    [`${INSTALLED_HONE}/package.json`, HONE_PACKAGE],
    ...shippedFiles,
  ]);

const installedEslintOf = (request: Consumer & { readonly file: string }): string | undefined =>
  request.file === INSTALLED_ESLINT || request.file.startsWith(`${INSTALLED_ESLINT}/`)
    ? `${ROOT}/node_modules/${request.line}${request.file.slice(INSTALLED_ESLINT.length)}`
    : undefined;

const directoriesOf = (request: { readonly files: ReadonlyMap<string, string> }): ReadonlySet<string> =>
  new Set(
    [...request.files.keys()].flatMap((file) => {
      const segments = file.split(SLASH).slice(0, -1);
      return segments.map((_, index) => segments.slice(0, index + 1).join(SLASH));
    }),
  );

const relativeToConsumer = (request: { readonly file: string }): string =>
  request.file.startsWith(`${CONSUMER_ROOT}/`) ? request.file.slice(CONSUMER_ROOT.length + 1) : request.file;

const diagnosticOf = (request: { readonly diagnostic: Diagnostic }): ConsumerDiagnostic => ({
  file: relativeToConsumer({ file: request.diagnostic.file?.fileName ?? "" }),
  code: request.diagnostic.code,
  message: syntaxApi
    .flattenDiagnosticMessageText(request.diagnostic.messageText, NEW_LINE)
    .split(NEW_LINE)[0]
    ?.replaceAll(`${CONSUMER_ROOT}/`, "") ?? "",
});

export const consumerDiagnosticsOn = (request: {
  readonly line: EslintLine;
  readonly resolution: Resolution;
  readonly form: ConsumerForm;
  readonly files: ConsumerFiles;
  readonly entry: string;
}): readonly ConsumerDiagnostic[] => {
  const options = optionsOn(request);
  const host = syntaxApi.createCompilerHost(options);
  const memory = memoryFilesOf(request);
  const directories = directoriesOf({ files: memory });
  const textOf = (file: string): string | undefined => {
    const installed = installedEslintOf({ ...request, file });
    return installed === undefined ? memory.get(file) : host.readFile(installed);
  };
  const program = syntaxApi.createProgram({
    rootNames: [`${CONSUMER_ROOT}/${request.entry}`],
    options,
    host: {
      ...host,
      fileExists: (file) => {
        const installed = installedEslintOf({ ...request, file });
        return installed === undefined ? memory.has(file) || host.fileExists(file) : host.fileExists(installed);
      },
      directoryExists: (directory) => {
        const installed = installedEslintOf({ ...request, file: directory });
        return installed === undefined ? directories.has(directory) || host.directoryExists?.(directory) === true : host.directoryExists?.(installed) === true;
      },
      readFile: (file) => textOf(file) ?? host.readFile(file),
      realpath: (file) => {
        const installed = installedEslintOf({ ...request, file });
        return installed === undefined ? file : (host.realpath?.(installed) ?? installed);
      },
      getSourceFile: (file, languageVersion) => {
        const text = textOf(file);
        return text === undefined ? host.getSourceFile(file, languageVersion) : syntaxApi.createSourceFile(file, text, languageVersion, true);
      },
    },
  });
  return syntaxApi.getPreEmitDiagnostics(program).map((diagnostic) => diagnosticOf({ diagnostic }));
};

export type ConsumerLocation = Omit<ConsumerDiagnostic, "message">;

export const consumerLocationsOn = (request: Parameters<typeof consumerDiagnosticsOn>[0]): readonly ConsumerLocation[] =>
  consumerDiagnosticsOn(request).map(({ file, code }) => ({ file, code }));
