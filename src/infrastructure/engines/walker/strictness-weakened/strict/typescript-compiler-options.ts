import type typescript from "typescript";

import { configRootOf, typeScriptConfigOf } from "../../runner/pieces/typescript-config.ts";
import type { WalkerDisk } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi } from "../../runner/toolchain/typescript-parse.ts";
import type {
  BaseConfig,
  CompilerOptionsResolutionOf,
  OptionSetting,
  OptionSettings,
  OptionState,
  ResolvedConfig,
  StrictOption,
} from "./compiler-options-resolution.ts";

const STRICT_FAMILY: readonly StrictOption[] = ["strict", "useUnknownInCatchVariables"];

type Paths = { readonly root: string };

const WILDCARD = /[*?]/;

const shownPath = (request: Paths & { readonly path: string }): string =>
  request.path.startsWith(`${request.root}/`)
    ? request.path.slice(request.root.length + 1)
    : request.path;

const stateOf = (request: { readonly turnedOn: unknown }): OptionState =>
  request.turnedOn === true ? "on" : "off";

const settingOf = (request: {
  readonly compilerOptions: object;
  readonly option: StrictOption;
}): OptionSetting => {
  const setting: unknown = Object.entries(request.compilerOptions).find(
    ([key]) => key === request.option,
  )?.[1];
  return typeof setting === "boolean" ? stateOf({ turnedOn: setting }) : "unset";
};

const settingsOf = (request: { readonly config: unknown }): OptionSettings => {
  const config = request.config;
  const compilerOptions =
    typeof config === "object" && config !== null && "compilerOptions" in config
      ? config.compilerOptions
      : undefined;
  const options =
    typeof compilerOptions === "object" && compilerOptions !== null ? compilerOptions : {};
  return {
    strict: settingOf({ compilerOptions: options, option: "strict" }),
    noUncheckedIndexedAccess: settingOf({
      compilerOptions: options,
      option: "noUncheckedIndexedAccess",
    }),
    exactOptionalPropertyTypes: settingOf({
      compilerOptions: options,
      option: "exactOptionalPropertyTypes",
    }),
    noImplicitOverride: settingOf({ compilerOptions: options, option: "noImplicitOverride" }),
    noFallthroughCasesInSwitch: settingOf({
      compilerOptions: options,
      option: "noFallthroughCasesInSwitch",
    }),
    noPropertyAccessFromIndexSignature: settingOf({
      compilerOptions: options,
      option: "noPropertyAccessFromIndexSignature",
    }),
    useUnknownInCatchVariables: settingOf({
      compilerOptions: options,
      option: "useUnknownInCatchVariables",
    }),
  };
};

const strictFamilyStateOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly options: typescript.CompilerOptions;
  readonly option: StrictOption;
}): OptionState => {
  const api: object = request.syntaxApi;
  if ("getStrictOptionValue" in api && typeof api.getStrictOptionValue === "function") {
    return stateOf({ turnedOn: api.getStrictOptionValue(request.options, request.option) });
  }
  return stateOf({ turnedOn: request.options[request.option] ?? request.options.strict });
};

const effectiveValueOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly options: typescript.CompilerOptions;
  readonly option: StrictOption;
}): OptionState =>
  STRICT_FAMILY.includes(request.option)
    ? strictFamilyStateOf(request)
    : stateOf({ turnedOn: request.options[request.option] });

const effectiveOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly options: typescript.CompilerOptions;
}): Readonly<Record<StrictOption, OptionState>> => ({
  strict: effectiveValueOf({ ...request, option: "strict" }),
  noUncheckedIndexedAccess: effectiveValueOf({ ...request, option: "noUncheckedIndexedAccess" }),
  exactOptionalPropertyTypes: effectiveValueOf({
    ...request,
    option: "exactOptionalPropertyTypes",
  }),
  noImplicitOverride: effectiveValueOf({ ...request, option: "noImplicitOverride" }),
  noFallthroughCasesInSwitch: effectiveValueOf({
    ...request,
    option: "noFallthroughCasesInSwitch",
  }),
  noPropertyAccessFromIndexSignature: effectiveValueOf({
    ...request,
    option: "noPropertyAccessFromIndexSignature",
  }),
  useUnknownInCatchVariables: effectiveValueOf({
    ...request,
    option: "useUnknownInCatchVariables",
  }),
});

const baseOf = (
  request: Paths & {
    readonly syntaxApi: SyntaxApi;
    readonly host: typescript.ParseConfigHost;
    readonly path: string;
  },
): BaseConfig => ({
  file: shownPath(request),
  settings: settingsOf({
    config: request.syntaxApi.readConfigFile(request.path, request.host.readFile).config,
  }),
});

const compiledFilesOf = (request: {
  readonly parsed: typescript.ParsedCommandLine;
  readonly includesListed: readonly string[];
}): "some" | "none" => {
  if (request.parsed.fileNames.length > 0) return "some";
  if (Object.keys(request.parsed.wildcardDirectories ?? {}).length > 0) return "some";
  return request.includesListed.some((include) => !WILDCARD.test(include)) ? "some" : "none";
};

const resolvedConfigOf = (
  request: Paths & {
    readonly syntaxApi: SyntaxApi;
    readonly disk: WalkerDisk;
    readonly path: string;
  },
): ResolvedConfig => {
  const config = typeScriptConfigOf(request);
  if (config.kind === "unresolved") return config;
  const { host, source, parsed, includesListed } = config;
  if (compiledFilesOf({ parsed, includesListed }) === "none") return { kind: "compiles-nothing" };
  return {
    kind: "resolved",
    effective: effectiveOf({ syntaxApi: request.syntaxApi, options: parsed.options }),
    bases: (source.extendedSourceFiles ?? []).map((path) => baseOf({ ...request, host, path })),
  };
};

export const typeScriptCompilerOptionsOf: CompilerOptionsResolutionOf = ({ syntaxApi, disk }) => {
  const root = configRootOf({ disk });
  return {
    resolve: ({ file }) => resolvedConfigOf({ syntaxApi, disk, root, path: `${root}/${file}` }),
  };
};
