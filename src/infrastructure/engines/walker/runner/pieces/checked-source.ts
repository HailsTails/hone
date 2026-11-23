import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { SyntaxApi } from "../toolchain/typescript-parse.ts";
import { folderScope, TYPESCRIPT_FILE } from "./source-scope.ts";
import { configRootOf, typeScriptConfigOf } from "./typescript-config.ts";
import type { WalkerDisk, WalkerFile } from "./walker-piece.ts";

export type SourceChecking = "checked" | "unchecked";

export type CheckedSource = (request: WalkerFile) => Result<SourceChecking, PieceFailure>;

type ConfigChecking = Result<SourceChecking, { readonly detail: string }>;

const JAVASCRIPT_FILE = /\.(?:js|jsx|mjs|cjs)$/;
const CHECK_PRAGMA = /^\/\/\/?\s*@ts-check(?=[\s:]|$)/i;

const nearestConfigOf = (request: {
  readonly disk: WalkerDisk;
  readonly root: string;
  readonly file: string;
}): string | undefined => {
  const folders = request.file.split("/").slice(0, -1);
  return folders
    .map((_, depth) => [...folders.slice(0, folders.length - depth), "tsconfig.json"].join("/"))
    .concat("tsconfig.json")
    .find((config) => request.disk.kindAt({ path: `${request.root}/${config}` }) === "file");
};

const configCheckingOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly disk: WalkerDisk;
  readonly root: string;
  readonly config: string;
}): ConfigChecking => {
  const parsed = typeScriptConfigOf({ ...request, path: `${request.root}/${request.config}` });
  if (parsed.kind === "unresolved")
    return {
      outcome: "failed",
      error: { detail: `${request.config} does not resolve: ${parsed.detail}` },
    };
  return { outcome: "ok", value: parsed.parsed.options.checkJs === true ? "checked" : "unchecked" };
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
  const root = configRootOf({ disk });
  const configChecking = new Map<string, ConfigChecking>();
  const checkingByConfig = ({ file }: { readonly file: string }): ConfigChecking => {
    const config = nearestConfigOf({ disk, root, file });
    if (config === undefined) return { outcome: "ok", value: "unchecked" };
    const known = configChecking.get(config) ?? configCheckingOf({ syntaxApi, disk, root, config });
    configChecking.set(config, known);
    return known;
  };
  return ({ file, readText }) => {
    if (folderScope({ file }) === "generated") return { outcome: "ok", value: "unchecked" };
    if (TYPESCRIPT_FILE.test(file)) return { outcome: "ok", value: "checked" };
    if (!JAVASCRIPT_FILE.test(file)) return { outcome: "ok", value: "unchecked" };
    const byConfig = checkingByConfig({ file });
    if (byConfig.outcome === "failed")
      return {
        outcome: "failed",
        error: { kind: "file-unparseable", file, detail: byConfig.error.detail },
      };
    if (byConfig.value === "checked") return byConfig;
    const text = readText();
    if (text.outcome === "failed") return text;
    return { outcome: "ok", value: pragmaCheckingOf({ syntaxApi, text: text.value }) };
  };
};
