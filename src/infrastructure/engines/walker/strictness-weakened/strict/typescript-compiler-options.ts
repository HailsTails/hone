import type typescript from "typescript";
import type { SyntaxApi } from "../../runner/toolchain/typescript-parse.ts";
import type { WalkerDisk } from "../../runner/pieces/walker-piece.ts";
import type { BaseConfig, CompilerOptionsResolutionOf, OptionSetting, OptionSettings, OptionState, ResolvedConfig, StrictOption } from "./compiler-options-resolution.ts";

const FILE_LIST_DIAGNOSTICS: readonly number[] = [18002, 18003];

const STRICT_FAMILY: readonly StrictOption[] = ["strict", "useUnknownInCatchVariables"];

type Paths = { readonly root: string };

const WILDCARD = /[*?]/;

type RecordingHost = { readonly host: typescript.ParseConfigHost; readonly includesListed: () => readonly string[] };

const recordingHostOf = (request: { readonly syntaxApi: SyntaxApi; readonly disk: WalkerDisk; readonly root: string }): RecordingHost => {
  const listed: string[] = [];
  return {
    host: {
      useCaseSensitiveFileNames: request.syntaxApi.sys.useCaseSensitiveFileNames,
      fileExists: (path) => request.disk.kindAt({ path }) === "file",
      directoryExists: (path) => request.disk.kindAt({ path }) === "directory",
      readFile: (path) => {
        const text = request.disk.textAt({ path });
        return text.outcome === "ok" ? text.value : undefined;
      },
      readDirectory: (...listing: Parameters<typescript.ParseConfigHost["readDirectory"]>) => {
        const [, , , includes] = listing;
        listed.push(...includes);
        return [];
      },
      getCurrentDirectory: () => request.root,
    },
    includesListed: () => listed,
  };
};

const shownPath = (request: Paths & { readonly path: string }): string =>
  request.path.startsWith(`${request.root}/`) ? request.path.slice(request.root.length + 1) : request.path;

const shownText = (request: Paths & { readonly text: string }): string => request.text.split(`${request.root}/`).join("");

const folderOf = (request: { readonly path: string }): string => request.path.slice(0, request.path.lastIndexOf("/"));

const stateOf = (request: { readonly turnedOn: unknown }): OptionState => (request.turnedOn === true ? "on" : "off");

const settingOf = (request: { readonly compilerOptions: object; readonly option: StrictOption }): OptionSetting => {
  const setting: unknown = Object.entries(request.compilerOptions).find(([key]) => key === request.option)?.[1];
  return typeof setting === "boolean" ? stateOf({ turnedOn: setting }) : "unset";
};

const settingsOf = (request: { readonly config: unknown }): OptionSettings => {
  const config = request.config;
  const compilerOptions = typeof config === "object" && config !== null && "compilerOptions" in config ? config.compilerOptions : undefined;
  const options = typeof compilerOptions === "object" && compilerOptions !== null ? compilerOptions : {};
  return {
    strict: settingOf({ compilerOptions: options, option: "strict" }),
    noUncheckedIndexedAccess: settingOf({ compilerOptions: options, option: "noUncheckedIndexedAccess" }),
    exactOptionalPropertyTypes: settingOf({ compilerOptions: options, option: "exactOptionalPropertyTypes" }),
    noImplicitOverride: settingOf({ compilerOptions: options, option: "noImplicitOverride" }),
    noFallthroughCasesInSwitch: settingOf({ compilerOptions: options, option: "noFallthroughCasesInSwitch" }),
    noPropertyAccessFromIndexSignature: settingOf({ compilerOptions: options, option: "noPropertyAccessFromIndexSignature" }),
    useUnknownInCatchVariables: settingOf({ compilerOptions: options, option: "useUnknownInCatchVariables" }),
  };
};

const strictFamilyStateOf = (request: { readonly syntaxApi: SyntaxApi; readonly options: typescript.CompilerOptions; readonly option: StrictOption }): OptionState => {
  const api: object = request.syntaxApi;
  if ("getStrictOptionValue" in api && typeof api.getStrictOptionValue === "function") {
    return stateOf({ turnedOn: api.getStrictOptionValue(request.options, request.option) });
  }
  return stateOf({ turnedOn: request.options[request.option] ?? request.options.strict });
};

const effectiveValueOf = (request: { readonly syntaxApi: SyntaxApi; readonly options: typescript.CompilerOptions; readonly option: StrictOption }): OptionState =>
  STRICT_FAMILY.includes(request.option) ? strictFamilyStateOf(request) : stateOf({ turnedOn: request.options[request.option] });

const effectiveOf = (request: { readonly syntaxApi: SyntaxApi; readonly options: typescript.CompilerOptions }): Readonly<Record<StrictOption, OptionState>> => ({
  strict: effectiveValueOf({ ...request, option: "strict" }),
  noUncheckedIndexedAccess: effectiveValueOf({ ...request, option: "noUncheckedIndexedAccess" }),
  exactOptionalPropertyTypes: effectiveValueOf({ ...request, option: "exactOptionalPropertyTypes" }),
  noImplicitOverride: effectiveValueOf({ ...request, option: "noImplicitOverride" }),
  noFallthroughCasesInSwitch: effectiveValueOf({ ...request, option: "noFallthroughCasesInSwitch" }),
  noPropertyAccessFromIndexSignature: effectiveValueOf({ ...request, option: "noPropertyAccessFromIndexSignature" }),
  useUnknownInCatchVariables: effectiveValueOf({ ...request, option: "useUnknownInCatchVariables" }),
});

const baseOf = (request: Paths & { readonly syntaxApi: SyntaxApi; readonly host: typescript.ParseConfigHost; readonly path: string }): BaseConfig => ({
  file: shownPath(request),
  settings: settingsOf({ config: request.syntaxApi.readConfigFile(request.path, request.host.readFile).config }),
});

const unresolvedDetail = (request: Paths & { readonly syntaxApi: SyntaxApi; readonly diagnostics: readonly typescript.Diagnostic[] }): string =>
  request.diagnostics
    .map((diagnostic) => `TS${diagnostic.code} ${shownText({ ...request, text: request.syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, " ") })}`)
    .join("; ");

const compiledFilesOf = (request: { readonly parsed: typescript.ParsedCommandLine; readonly includesListed: readonly string[] }): "some" | "none" => {
  if (request.parsed.fileNames.length > 0) return "some";
  if (Object.keys(request.parsed.wildcardDirectories ?? {}).length > 0) return "some";
  return request.includesListed.some((include) => !WILDCARD.test(include)) ? "some" : "none";
};

const resolvedConfigOf = (
  request: Paths & { readonly syntaxApi: SyntaxApi; readonly recording: RecordingHost; readonly path: string },
): ResolvedConfig => {
  const host = request.recording.host;
  const source = request.syntaxApi.readJsonConfigFile(request.path, host.readFile);
  const parsed = request.syntaxApi.parseJsonSourceFileConfigFileContent(source, host, folderOf(request), undefined, request.path);
  const diagnostics = parsed.errors.filter((diagnostic) => !FILE_LIST_DIAGNOSTICS.includes(diagnostic.code));
  if (diagnostics.length > 0) return { kind: "unresolved", detail: unresolvedDetail({ ...request, diagnostics }) };
  if (compiledFilesOf({ parsed, includesListed: request.recording.includesListed() }) === "none") return { kind: "compiles-nothing" };
  return {
    kind: "resolved",
    effective: effectiveOf({ syntaxApi: request.syntaxApi, options: parsed.options }),
    bases: (source.extendedSourceFiles ?? []).map((path) => baseOf({ ...request, host, path })),
  };
};

export const typeScriptCompilerOptionsOf: CompilerOptionsResolutionOf = ({ syntaxApi, disk }) => {
  const root = disk.root.split("\\").join("/");
  return {
    resolve: ({ file }) => {
      const recording = recordingHostOf({ syntaxApi, disk, root });
      return resolvedConfigOf({ syntaxApi, recording, root, path: `${root}/${file}` });
    },
  };
};
