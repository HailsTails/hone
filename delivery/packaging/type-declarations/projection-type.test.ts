import { assert, describe, expect, it } from "vitest";
import { createDefaultTypeScriptDeclarationPort } from "./typescript-declaration-port.ts";
import type { CompilerOptions, Diagnostic } from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { installedEslintBoundary } from "../../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { checksProjectionText } from "../../../src/infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import { repoPathOf } from "../../../src/domain/repository/repo-path-of.ts";

const installedBoundary = await installedEslintBoundary();

if (installedBoundary.outcome === "failed") {
  throw new Error(installedBoundary.error);
}

const DECLARATION_TEXT: string = installedBoundary.value.declarationText;

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../..`, installForm: "source" }) });

assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");

assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);

type EslintLine = "eslint" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint", "eslint-9"];

type Resolution = "bundler" | "nodenext";

const RESOLUTIONS: readonly Resolution[] = ["bundler", "nodenext"];

type ConsumerForm = "typescript" | "checked-javascript";

type ConsumerFiles = Readonly<Record<string, string>>;

type ConsumerDiagnostic = { readonly file: string; readonly code: number; readonly message: string };

const syntaxApi = loadedParsePort.value.syntaxApi;

const SLASH = "/";

const BACKSLASH = String.fromCharCode(92);

const NEW_LINE = "\n";

const ROOT = syntaxApi.sys.resolvePath(`${import.meta.dirname}/../../..`).replaceAll(BACKSLASH, SLASH);

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

const consumerDiagnosticsOn = (request: {
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

type ConsumerLocation = Omit<ConsumerDiagnostic, "message">;

const consumerLocationsOn = (request: Parameters<typeof consumerDiagnosticsOn>[0]): readonly ConsumerLocation[] =>
  consumerDiagnosticsOn(request).map(({ file, code }) => ({ file, code }));

const PLUGIN_SPECIFIER = "@hailstails/hone/eslint-plugin";

const CHECKS = [
  { symptom: "S-1", check: "C-1", ruleId: "hone/S-1-C-1", options: [{ maximum: 3 }] },
  { symptom: "S-2", check: "C-2", ruleId: "hone/S-2-C-2", options: [] },
];

const ROOT_PROJECTION = checksProjectionText({
  pluginImport: PLUGIN_SPECIFIER,
  checks: CHECKS,
  answered: [{ symptom: "S-1", check: "C-1", file: repoPathOf("src/old.ts") }],
});

const PACKAGE_PROJECTION = checksProjectionText({ pluginImport: PLUGIN_SPECIFIER, checks: CHECKS, answered: [] });

const CONFIG_API = "eslint/config";

const ROOT_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import hone from "./hone.eslint.mjs";

export default defineConfig([...hone, { files: ["**/*.ts"], rules: {} }]);
`;

const PACKAGE_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import root from "../../hone.eslint.mjs";
import slice from "./hone.eslint.mjs";

export default defineConfig([...root, ...slice, { files: ["**/*.ts"], rules: {} }]);
`;

const MISUSE = `import hone from "./hone.eslint.mjs";

export const first: string = hone[0];

export const count: string = hone.length;
`;

const DECLARATIONS: ConsumerFiles = { "hone.eslint.d.mts": DECLARATION_TEXT, "packages/a/hone.eslint.d.mts": DECLARATION_TEXT };

const NO_DECLARATIONS: ConsumerFiles = {};

const withEntry = (request: { readonly entry: string; readonly entryText: string; readonly declaration: ConsumerFiles }): ConsumerFiles => ({
  [request.entry]: request.entryText,
  "hone.eslint.mjs": ROOT_PROJECTION,
  "packages/a/hone.eslint.mjs": PACKAGE_PROJECTION,
  ...request.declaration,
});

const NOT_ASSIGNABLE_TO_STRING_FROM_A_CONFIG = {
  file: "misuse.ts",
  code: 2322,
  message: "Type 'Config<RulesConfig>' is not assignable to type 'string'.",
};

const NOT_ASSIGNABLE_TO_STRING_FROM_A_NUMBER = { file: "misuse.ts", code: 2322, message: "Type 'number' is not assignable to type 'string'." };

const NO_DECLARATION_TO_IMPORT = {
  file: "eslint.config.ts",
  code: 7016,
  message: "Could not find a declaration file for module './hone.eslint.mjs'. 'hone.eslint.mjs' implicitly has an 'any' type.",
};

const NOT_A_CONFIG_BLOCK = { file: "eslint.config.mjs", code: 2322 };

const ESLINT_PACKAGE = "eslint";

const PLUGIN_USE = `import type { ESLint, Linter } from "${ESLINT_PACKAGE}";
import hone from "${PLUGIN_SPECIFIER}";

export const plugin: ESLint.Plugin = hone;

export const configs: Linter.Config[] = [{ plugins: { hone } }];
`;

const PLUGIN_USED_AS_A_STRING = `import hone from "${PLUGIN_SPECIFIER}";

export const name: string = hone;
`;

const PLUGIN_NOT_A_STRING = { file: "plugin-misuse.ts", code: 2322, message: "Type 'HonePlugin' is not assignable to type 'string'." };

describe.each(ESLINT_LINES)("a typed ESLint config importing a version 2 projection, compiled in memory against the consumer's own node_modules/eslint on %s, under strict with skipLibCheck off (CD-47: nothing is spawned or written)", (line) => {
  describe.each(RESOLUTIONS)("under %s resolution", (resolution) => {
    it("compiles a .ts config for the root projection with the declaration beside it", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "eslint.config.ts", files: withEntry({ entry: "eslint.config.ts", entryText: ROOT_CONFIG, declaration: DECLARATIONS }) }),
      ).toEqual([]);
    });

    it("compiles a .ts config for a package slice over the root projection with the declarations beside them", () => {
      expect(
        consumerDiagnosticsOn({
          line,
          resolution,
          form: "typescript",
          entry: "packages/a/eslint.config.ts",
          files: withEntry({ entry: "packages/a/eslint.config.ts", entryText: PACKAGE_CONFIG, declaration: DECLARATIONS }),
        }),
      ).toEqual([]);
    });

    it("compiles a checked .mjs config for the root projection with the declaration beside it", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "checked-javascript", entry: "eslint.config.mjs", files: withEntry({ entry: "eslint.config.mjs", entryText: ROOT_CONFIG, declaration: DECLARATIONS }) }),
      ).toEqual([]);
    });

    it("compiles a checked .mjs config for a package slice over the root projection with the declarations beside them", () => {
      expect(
        consumerDiagnosticsOn({
          line,
          resolution,
          form: "checked-javascript",
          entry: "packages/a/eslint.config.mjs",
          files: withEntry({ entry: "packages/a/eslint.config.mjs", entryText: PACKAGE_CONFIG, declaration: DECLARATIONS }),
        }),
      ).toEqual([]);
    });

    it("types the default export as an array of ESLint's own configs, so using it as a string names both ways it is not one", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "misuse.ts", files: withEntry({ entry: "misuse.ts", entryText: MISUSE, declaration: DECLARATIONS }) }),
      ).toEqual([NOT_ASSIGNABLE_TO_STRING_FROM_A_CONFIG, NOT_ASSIGNABLE_TO_STRING_FROM_A_NUMBER]);
    });

    it("leaves a .ts config importing a projection with no type to import when no declaration is beside it", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "eslint.config.ts", files: withEntry({ entry: "eslint.config.ts", entryText: ROOT_CONFIG, declaration: NO_DECLARATIONS }) }),
      ).toEqual([NO_DECLARATION_TO_IMPORT]);
    });

    it("leaves a checked .mjs config importing a projection typed as the union of the shapes its blocks have when no declaration is beside it", () => {
      expect(
        consumerLocationsOn({ line, resolution, form: "checked-javascript", entry: "eslint.config.mjs", files: withEntry({ entry: "eslint.config.mjs", entryText: ROOT_CONFIG, declaration: NO_DECLARATIONS }) }),
      ).toEqual([NOT_A_CONFIG_BLOCK, NOT_A_CONFIG_BLOCK]);
    });

    it("takes the shipped plugin declaration as ESLint's plugin type, alone and in a flat config", () => {
      expect(consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "plugin-use.ts", files: { "plugin-use.ts": PLUGIN_USE } })).toEqual([]);
    });

    it("types the shipped plugin's default export as the plugin, not as any", () => {
      expect(consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "plugin-misuse.ts", files: { "plugin-misuse.ts": PLUGIN_USED_AS_A_STRING } })).toEqual([PLUGIN_NOT_A_STRING]);
    });
  });
});
