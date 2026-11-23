import { type JSONVisitor, visit } from "jsonc-parser";

import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import { createDefaultJsoncParsePort } from "./jsonc-parse.ts";
import { folderScope } from "./source-scope.ts";
import type { WalkerFile } from "./walker-piece.ts";

type Field = readonly [string, unknown];

export const fieldsOf = (value: unknown): readonly Field[] =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [];

export const PACKAGE_MANIFEST = /(?:^|\/)package\.json$/;
export const WORKFLOW =
  /^(?:\.github\/workflows\/.*\.ya?ml|\.gitlab-ci\.ya?ml|azure-pipelines\.ya?ml)$/;

type ReadFile<Content> = Result<Content | undefined, PieceFailure>;

export const dependencySourceOf = (
  request: WalkerFile & {
    readonly accepts: RegExp;
  },
): ReadFile<string> =>
  request.accepts.test(request.file) && folderScope({ file: request.file }) !== "generated"
    ? request.readText()
    : { outcome: "ok", value: undefined };

const jsonc = createDefaultJsoncParsePort({ trailingCommas: "refused" });

type PackageManifest = { readonly source: string; readonly fields: ReadonlyMap<string, unknown> };

const readPackageManifest = (file: WalkerFile): ReadFile<PackageManifest> => {
  const text = dependencySourceOf({ ...file, accepts: PACKAGE_MANIFEST });
  if (text.outcome === "failed") return text;
  if (text.value === undefined) return { outcome: "ok", value: undefined };
  const parsed = jsonc.parse({ source: text.value });
  return parsed.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "file-unparseable", file: file.file, detail: parsed.error.detail },
      }
    : {
        outcome: "ok",
        value: { source: text.value, fields: new Map(fieldsOf(parsed.value)) },
      };
};

export const packageManifestOf = (file: WalkerFile): ReadFile<ReadonlyMap<string, unknown>> => {
  const manifest = readPackageManifest(file);
  return manifest.outcome === "failed"
    ? manifest
    : { outcome: "ok", value: manifest.value?.fields };
};

type FieldSite = { readonly anchor: Anchor; readonly snippet: string };

type LocatedManifest = {
  readonly fields: PackageManifest["fields"];
  readonly fieldAt: (path: readonly string[]) => FieldSite | undefined;
};

const manifestSitesOf = (source: string): LocatedManifest["fieldAt"] => {
  const properties = new Map<string, { readonly offset: number; readonly anchor: Anchor }>();
  const sites = new Map<string, FieldSite>();
  const visitor: JSONVisitor = {
    onObjectProperty: (name, offset, length, line, column, parentPath) => {
      const key = JSON.stringify([...parentPath(), name]);
      const anchor = { line: line + 1, column };
      properties.set(key, { offset, anchor });
      sites.set(key, { anchor, snippet: source.slice(offset, offset + length) });
    },
    onLiteralValue: (value: unknown, offset, length, _line, _column, path) => {
      if (typeof value !== "string") return;
      const key = JSON.stringify(path());
      const property = properties.get(key);
      if (property === undefined) return;
      sites.set(key, {
        anchor: property.anchor,
        snippet: source.slice(property.offset, offset + length).replace(/\r?\n[ \t]*/g, " "),
      });
    },
  };
  visit(source, visitor);
  return (path) => sites.get(JSON.stringify(path));
};

export const locatedPackageManifestOf = (file: WalkerFile): ReadFile<LocatedManifest> => {
  const manifest = readPackageManifest(file);
  if (manifest.outcome === "failed") return manifest;
  return {
    outcome: "ok",
    value:
      manifest.value === undefined
        ? undefined
        : {
            fields: manifest.value.fields,
            fieldAt: manifestSitesOf(manifest.value.source),
          },
  };
};
