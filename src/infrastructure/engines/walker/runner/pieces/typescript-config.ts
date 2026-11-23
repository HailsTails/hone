import type {
  Diagnostic,
  ParseConfigHost,
  ParsedCommandLine,
  SyntaxApi,
  TsConfigSourceFile,
} from "../toolchain/typescript-parse.ts";
import type { WalkerDisk } from "./walker-piece.ts";

const FILE_LIST_DIAGNOSTICS: readonly number[] = [18002, 18003];

export type TypeScriptConfig =
  | {
      readonly kind: "parsed";
      readonly host: ParseConfigHost;
      readonly source: TsConfigSourceFile;
      readonly parsed: ParsedCommandLine;
      readonly includesListed: readonly string[];
    }
  | { readonly kind: "unresolved"; readonly detail: string };

export const configRootOf = (request: { readonly disk: WalkerDisk }): string =>
  request.disk.root.split("\\").join("/");

const unresolvedDetail = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly root: string;
  readonly diagnostics: readonly Diagnostic[];
}): string =>
  request.diagnostics
    .map(
      (diagnostic) =>
        `TS${diagnostic.code} ${request.syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, " ").split(`${request.root}/`).join("")}`,
    )
    .join("; ");

export const typeScriptConfigOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly disk: WalkerDisk;
  readonly root: string;
  readonly path: string;
}): TypeScriptConfig => {
  const { syntaxApi, disk, root, path } = request;
  const listed: string[] = [];
  const host: ParseConfigHost = {
    useCaseSensitiveFileNames: syntaxApi.sys.useCaseSensitiveFileNames,
    fileExists: (candidate) => disk.kindAt({ path: candidate }) === "file",
    directoryExists: (candidate) => disk.kindAt({ path: candidate }) === "directory",
    readFile: (candidate) => {
      const text = disk.textAt({ path: candidate });
      return text.outcome === "ok" ? text.value : undefined;
    },
    readDirectory: (...listing: Parameters<ParseConfigHost["readDirectory"]>) => {
      const [, , , includes] = listing;
      listed.push(...includes);
      return [];
    },
    getCurrentDirectory: () => root,
  };
  const source = syntaxApi.readJsonConfigFile(path, host.readFile);
  const parsed = syntaxApi.parseJsonSourceFileConfigFileContent(
    source,
    host,
    path.slice(0, path.lastIndexOf("/")),
    undefined,
    path,
  );
  const diagnostics = parsed.errors.filter(
    (diagnostic) => !FILE_LIST_DIAGNOSTICS.includes(diagnostic.code),
  );
  if (diagnostics.length > 0)
    return { kind: "unresolved", detail: unresolvedDetail({ syntaxApi, root, diagnostics }) };
  return { kind: "parsed", host, source, parsed, includesListed: listed };
};
