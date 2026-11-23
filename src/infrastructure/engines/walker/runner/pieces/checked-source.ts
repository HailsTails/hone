import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { ParseConfigHost, SyntaxApi } from "../toolchain/typescript-parse.ts";
import { folderScope, TYPESCRIPT_FILE } from "./source-scope.ts";
import type { WalkerDisk, WalkerFile } from "./walker-piece.ts";

export type SourceChecking = "checked" | "unchecked";

export type CheckedSource = (request: WalkerFile) => Result<SourceChecking, PieceFailure>;

const JAVASCRIPT_FILE = /\.(?:js|jsx|mjs|cjs)$/;
const CHECK_PRAGMA = /^\/\/\/?\s*@ts-check(?=[\s:]|$)/i;

const configHostOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly disk: WalkerDisk;
}): ParseConfigHost => ({
  useCaseSensitiveFileNames: request.syntaxApi.sys.useCaseSensitiveFileNames,
  fileExists: (path) => request.disk.kindAt({ path }) === "file",
  readFile: (path) => {
    const text = request.disk.textAt({ path });
    return text.outcome === "ok" ? text.value : undefined;
  },
  readDirectory: () => [],
});

const nearestConfigOf = (request: {
  readonly disk: WalkerDisk;
  readonly root: string;
  readonly file: string;
}): string | undefined => {
  const folders = request.file.split("/").slice(0, -1);
  return folders
    .map((_, depth) => [request.root, ...folders.slice(0, folders.length - depth)].join("/"))
    .concat(request.root)
    .map((folder) => `${folder}/tsconfig.json`)
    .find((path) => request.disk.kindAt({ path }) === "file");
};

const configCheckingOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly host: ParseConfigHost;
  readonly path: string;
}): SourceChecking => {
  const source = request.syntaxApi.readJsonConfigFile(request.path, request.host.readFile);
  const parsed = request.syntaxApi.parseJsonSourceFileConfigFileContent(
    source,
    request.host,
    request.path.slice(0, request.path.lastIndexOf("/")),
    undefined,
    request.path,
  );
  return parsed.options.checkJs === true ? "checked" : "unchecked";
};

const pragmaCheckingOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly text: string;
}): SourceChecking =>
  (request.syntaxApi.getLeadingCommentRanges(request.text, 0) ?? []).some((range) =>
    CHECK_PRAGMA.test(request.text.slice(range.pos, range.end)),
  )
    ? "checked"
    : "unchecked";

export const checkedSourceOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly disk: WalkerDisk;
}): CheckedSource => {
  const { syntaxApi, disk } = request;
  const root = disk.root.split("\\").join("/");
  const host = configHostOf({ syntaxApi, disk });
  const configChecking = new Map<string, SourceChecking>();
  const checkingByConfig = ({ file }: { readonly file: string }): SourceChecking => {
    const path = nearestConfigOf({ disk, root, file });
    if (path === undefined) return "unchecked";
    const known = configChecking.get(path) ?? configCheckingOf({ syntaxApi, host, path });
    configChecking.set(path, known);
    return known;
  };
  return ({ file, readText }) => {
    if (folderScope({ file }) === "generated") return { outcome: "ok", value: "unchecked" };
    if (TYPESCRIPT_FILE.test(file)) return { outcome: "ok", value: "checked" };
    if (!JAVASCRIPT_FILE.test(file)) return { outcome: "ok", value: "unchecked" };
    if (checkingByConfig({ file }) === "checked") return { outcome: "ok", value: "checked" };
    const text = readText();
    if (text.outcome === "failed") return text;
    return { outcome: "ok", value: pragmaCheckingOf({ syntaxApi, text: text.value }) };
  };
};
