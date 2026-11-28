import type { Result } from "../../../src/domain/result.ts";
import type { RunnerFailure } from "../../../src/domain/runner/runner-failure.ts";
import type {
  CompilerOptions,
  Diagnostic,
  SyntaxApi,
  TypeScriptParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { CONSUMER_ROOT, createConsumerFiles } from "./consumer-files.ts";
import type {
  ConsumerDiagnostic,
  ConsumerForm,
  ConsumerProgram,
  ConsumerResolution,
  ConsumerTypesPort,
} from "./consumer-types-port.ts";
import type { ModulePathKind } from "./module-files-port.ts";

export type LoadParsePort = () => Promise<Result<TypeScriptParsePort, RunnerFailure>>;

const createResolutionOptions = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly resolution: ConsumerResolution;
}): CompilerOptions => {
  const { ModuleKind, ModuleResolutionKind } = request.syntaxApi;
  switch (request.resolution) {
    case "nodenext":
      return { module: ModuleKind.NodeNext, moduleResolution: ModuleResolutionKind.NodeNext };
    case "bundler":
      return { module: ModuleKind.ESNext, moduleResolution: ModuleResolutionKind.Bundler };
  }
};

const createFormOptions = (request: { readonly form: ConsumerForm }): CompilerOptions => {
  switch (request.form) {
    case "typescript":
      return { allowJs: false, checkJs: false };
    case "checked-javascript":
      return { allowJs: true, checkJs: true };
  }
};

const createStrictOptions = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly program: ConsumerProgram;
}): CompilerOptions => ({
  strict: true,
  noEmit: true,
  skipLibCheck: false,
  target: request.syntaxApi.ScriptTarget.ESNext,
  types: [],
  ...createResolutionOptions({
    syntaxApi: request.syntaxApi,
    resolution: request.program.resolution,
  }),
  ...createFormOptions({ form: request.program.form }),
});

const mapDiagnosticToConsumer = (diagnostic: Diagnostic): ConsumerDiagnostic => ({
  path: diagnostic.file?.fileName.replace(`${CONSUMER_ROOT}/`, ""),
  code: diagnostic.code,
  message: (typeof diagnostic.messageText === "string"
    ? diagnostic.messageText
    : diagnostic.messageText.messageText
  ).replaceAll(`${CONSUMER_ROOT}/`, ""),
});

const readDiskKind = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly path: string;
}): ModulePathKind => {
  const { sys } = request.syntaxApi;
  if (sys.fileExists(request.path)) {
    return "file";
  }
  return sys.directoryExists(request.path) ? "directory" : "absent";
};

const readDiagnostics = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly program: ConsumerProgram;
}): readonly ConsumerDiagnostic[] => {
  const { syntaxApi } = request;
  const options = createStrictOptions(request);
  const host = syntaxApi.createCompilerHost(options);
  const files = createConsumerFiles({
    contents: request.program,
    disk: {
      readKind: ({ path }) => readDiskKind({ syntaxApi, path }),
      readText: ({ path }) => syntaxApi.sys.readFile(path),
      resolvePath: ({ path }) => syntaxApi.sys.realpath?.(path) ?? path,
    },
  });
  const program = syntaxApi.createProgram({
    rootNames: [`${CONSUMER_ROOT}/${request.program.entry}`],
    options,
    host: {
      ...host,
      fileExists: (path) => files.readKind({ path }) === "file",
      directoryExists: (path) => files.readKind({ path }) === "directory",
      readFile: (path) => files.readText({ path }),
      realpath: (path) => files.resolvePath({ path }),
      getSourceFile: (path, languageVersion) => {
        const text = files.readText({ path });
        return text === undefined
          ? host.getSourceFile(path, languageVersion)
          : syntaxApi.createSourceFile(path, text, languageVersion, true);
      },
    },
  });
  return syntaxApi.getPreEmitDiagnostics(program).map(mapDiagnosticToConsumer);
};

export const createConsumerTypesPort = (options: {
  readonly load: LoadParsePort;
}): ConsumerTypesPort => ({
  read: async (program) => {
    const parse = await options.load();
    return parse.outcome === "failed"
      ? parse
      : { outcome: "ok", value: readDiagnostics({ syntaxApi: parse.value.syntaxApi, program }) };
  },
});

export const createDefaultConsumerTypesPort = (options: {
  readonly installRoot: string;
}): ConsumerTypesPort =>
  createConsumerTypesPort({
    load: () =>
      loadParsePort({
        peers: defaultTypeScriptPeers({ installRoot: options.installRoot, installForm: "source" }),
      }),
  });
