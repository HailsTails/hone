import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import { directoryOf, relativeSpecifierOf, resolvedPathOf } from "./relative-specifier.ts";

export type ConfigImportRefusal =
  | { readonly kind: "no-projection-import"; readonly file: RepoPath; readonly projection: RepoPath }
  | { readonly kind: "several-projection-imports"; readonly file: RepoPath; readonly count: number }
  | { readonly kind: "projection-named-elsewhere"; readonly file: RepoPath };

export type ProjectionPair = { readonly versionOneProjection: RepoPath; readonly versionTwoProjection: RepoPath };

export type ConfigImportRewriteRequest = {
  readonly file: RepoPath;
  readonly text: string;
  readonly pairs: readonly ProjectionPair[];
};

export type ProjectionImportingRequest = { readonly file: RepoPath; readonly text: string; readonly versionOneProjection: RepoPath };

type ProjectionImport = { readonly specifierStart: number; readonly specifier: string };

const STATIC_DEFAULT_IMPORT = /\bimport\s+[A-Za-z_$][\w$]*\s+from\s+(["'])(\.{1,2}\/[^"'\n]*)\1/g;

const PATH_SEPARATOR = "/";

const QUOTE_LENGTH = 1;

const COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

const NOT_A_LINE_BREAK = /[^\n]/g;

const OVERWRITING_SPACE = " ";

const withoutComments = (request: { readonly text: string }): string =>
  request.text.replace(COMMENT, (comment) => comment.replace(NOT_A_LINE_BREAK, OVERWRITING_SPACE));

const importsOf = (request: { readonly text: string }): readonly ProjectionImport[] =>
  [...withoutComments({ text: request.text }).matchAll(STATIC_DEFAULT_IMPORT)].map((found) => ({
    specifierStart: found.index + found[0].length - found[2].length - QUOTE_LENGTH,
    specifier: found[2],
  }));

const projectionImportsOf = (request: ProjectionImportingRequest): readonly ProjectionImport[] =>
  importsOf({ text: request.text }).filter(
    ({ specifier }) => resolvedPathOf({ directory: directoryOf({ file: request.file }), specifier }) === request.versionOneProjection,
  );

export type ProjectionImporting = "imports" | "does-not-import";

export const projectionImportingOf = (request: ProjectionImportingRequest): ProjectionImporting =>
  projectionImportsOf(request).length > 0 ? "imports" : "does-not-import";

const mentionsOf = (request: { readonly text: string; readonly name: string }): number => request.text.split(request.name).length - 1;

const nameOf = (request: { readonly path: RepoPath }): string => request.path.slice(request.path.lastIndexOf(PATH_SEPARATOR) + 1);

type Edit = { readonly specifierStart: number; readonly specifier: string; readonly replacement: string };

const editOf = (request: { readonly config: ConfigImportRewriteRequest; readonly pair: ProjectionPair }): Result<Edit, ConfigImportRefusal> => {
  const { config, pair } = request;
  const found = projectionImportsOf({ file: config.file, text: config.text, versionOneProjection: pair.versionOneProjection });
  const [only, ...others] = found;
  if (only === undefined) {
    return { outcome: "failed", error: { kind: "no-projection-import", file: config.file, projection: pair.versionOneProjection } };
  }
  if (others.length > 0) {
    return { outcome: "failed", error: { kind: "several-projection-imports", file: config.file, count: found.length } };
  }
  const replacement = relativeSpecifierOf({ directory: directoryOf({ file: config.file }), target: pair.versionTwoProjection });
  return { outcome: "ok", value: { ...only, replacement } };
};

const namedElsewhereRefusal = (request: { readonly config: ConfigImportRewriteRequest }): ConfigImportRefusal | undefined => {
  const named = request.config.pairs.some((pair) => {
    const name = nameOf({ path: pair.versionOneProjection });
    const importing = request.config.pairs.filter((other) => nameOf({ path: other.versionOneProjection }) === name).length;
    return mentionsOf({ text: request.config.text, name }) > importing;
  });
  return named ? { kind: "projection-named-elsewhere", file: request.config.file } : undefined;
};

const appliedTo = (request: { readonly text: string; readonly edits: readonly Edit[] }): string =>
  request.edits
    .toSorted((first, second) => second.specifierStart - first.specifierStart)
    .reduce((text, edit) => `${text.slice(0, edit.specifierStart)}${edit.replacement}${text.slice(edit.specifierStart + edit.specifier.length)}`, request.text);

export const rewrittenConfigOf = (request: ConfigImportRewriteRequest): Result<string, ConfigImportRefusal> => {
  const edits = request.pairs.map((pair) => editOf({ config: request, pair }));
  const refused = edits.find((edit) => edit.outcome === "failed");
  if (refused !== undefined) {
    return refused;
  }
  const named = namedElsewhereRefusal({ config: request });
  if (named !== undefined) {
    return { outcome: "failed", error: named };
  }
  return { outcome: "ok", value: appliedTo({ text: request.text, edits: edits.flatMap((edit) => (edit.outcome === "ok" ? [edit.value] : [])) }) };
};
