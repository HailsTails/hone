import { z } from "zod";

import { CATALOGUE_NAME } from "../../../src/domain/language-layer/catalogue-name.ts";
import type { Result } from "../../../src/domain/result.ts";
import { parsedJson } from "../../../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { namedPieceImplementationSchema } from "../../../src/infrastructure/engines/named-piece.ts";
import { CHANGELOG_FILE } from "../../release/changelog.ts";
import { dataShippingOf } from "../shipped-files/shipped-data.ts";
import { PUBLIC_TYPE_ENTRIES } from "../type-declarations/package-declarations.ts";

export type PlanFailure = {
  readonly kind: "piece-invalid";
  readonly path: string;
  readonly detail: string;
};

export type PieceText = { readonly path: string; readonly text: string };

export type PackagePlan = {
  readonly entryPoints: readonly string[];
  readonly command: string;
  readonly copied: readonly string[];
  readonly pieces: readonly PieceText[];
  readonly exported: readonly string[];
};

export const SHIPPED_NODE_RANGE = "^22.18.0 || >=24";

export const SHIPPED_NODE_TARGET = "node22.18";

const SOURCE_MODULE_EXTENSION = ".ts";

const BUILT_MODULE_EXTENSION = ".js";

const COMMAND_SOURCE = "src/hone.ts";

const RUNNER_ENTRY = /^src\/infrastructure\/engines\/[^/]+\/runner\/runner\.ts$/;

const PIECE_FILE = /^src\/infrastructure\/engines\/([^/]+)\/([^/]+)\/piece\.json$/;

const NAMED_PIECE_FILE = new RegExp(
  `^src/infrastructure/engines/([^/]+)/(${CATALOGUE_NAME})/(${CATALOGUE_NAME})/piece\\.json$`,
);

const RUNNER_FOLDER = "runner";

const SHIPPED_DOCUMENTS = new Set([
  "README.md",
  "ADOPTING.md",
  "MIGRATING.md",
  "LICENSE",
  "docs/why-chain-contract.md",
  "docs/adding-a-discipline-or-mechanism.md",
  "docs/extending.md",
]);

const RELEASE_WRITTEN_DOCUMENTS: ReadonlySet<string> = new Set([CHANGELOG_FILE]);

export type DocumentAuthor = "release" | "maintainer";

export const documentAuthorOf = (request: { readonly path: string }): DocumentAuthor =>
  RELEASE_WRITTEN_DOCUMENTS.has(request.path) ? "release" : "maintainer";

const PACKAGE_IMPORTED_MECHANISMS: ReadonlySet<string> = new Set(["eslint"]);

export const TEST_FOLDERS: ReadonlySet<string> = new Set([
  "tests",
  "package-manifests",
  "team-rule-set",
  "command-line-options",
  "fr3-anchors",
  "fragment-not-projection",
  "global-ignore",
  "inline-forms",
  "monorepo-package-config",
  "monorepo-root-config",
  "override-after",
  "projection-hand-edited",
  "projection-missing",
  "projection-not-imported",
  "re-enabled-record",
  "route-brackets",
  "severity-zero",
  "suppression-default",
  "suppression-nested",
  "suppression-scripted",
]);

const TEST_FILE_SUFFIX = ".test.ts";

const pieceModuleSettingsSchema = z.looseObject({
  module: z.string().optional(),
  pluginModule: z.string().optional(),
});

const legacyPieceFileSchema = z.looseObject({
  clauses: z.array(z.looseObject({ settings: pieceModuleSettingsSchema })),
});

const namedPieceFileSchema = z.looseObject({
  version: z.literal(2),
  implementation: namedPieceImplementationSchema.optional(),
  settings: pieceModuleSettingsSchema.optional(),
});

const pieceFileSchema = z.union([
  namedPieceFileSchema.transform((file) => ({ kind: "named" as const, file })),
  legacyPieceFileSchema.transform((file) => ({ kind: "legacy" as const, file })),
]);

const PIECE_MODULE_KEYS: ReadonlySet<string> = new Set(pieceModuleSettingsSchema.keyof().options);

type PieceFile = z.infer<typeof pieceFileSchema>;

type PieceModuleSettings = z.infer<typeof pieceModuleSettingsSchema>;

type SourceForm = "shipped" | "test-only";

const sourceFormOf = (request: { readonly path: string }): SourceForm =>
  request.path.endsWith(TEST_FILE_SUFFIX) ||
  request.path.split("/").some((segment) => TEST_FOLDERS.has(segment))
    ? "test-only"
    : "shipped";

const shippedPaths = (request: { readonly sourcePaths: readonly string[] }): readonly string[] =>
  request.sourcePaths.filter((path) => sourceFormOf({ path }) === "shipped");

export const builtModulePath = (request: { readonly path: string }): string =>
  request.path.endsWith(SOURCE_MODULE_EXTENSION)
    ? `${request.path.slice(0, -SOURCE_MODULE_EXTENSION.length)}${BUILT_MODULE_EXTENSION}`
    : request.path;

export const piecePathsIn = (request: {
  readonly sourcePaths: readonly string[];
}): readonly string[] =>
  shippedPaths(request).filter((path) => {
    const match = PIECE_FILE.exec(path);
    const named = NAMED_PIECE_FILE.exec(path);
    return (
      (named !== null && named[2] !== RUNNER_FOLDER) ||
      (match !== null && match[2] !== RUNNER_FOLDER)
    );
  });

type ParsedPiece = {
  readonly piece: PieceText;
  readonly document: unknown;
  readonly file: PieceFile;
};

const parsedPieceOf = (request: {
  readonly piece: PieceText;
}): Result<ParsedPiece, PlanFailure> => {
  const document = parsedJson({ text: request.piece.text });
  if (document.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "piece-invalid", path: request.piece.path, detail: document.error },
    };
  }
  const parsed = pieceFileSchema.safeParse(document.value);
  return parsed.success
    ? {
        outcome: "ok",
        value: { piece: request.piece, document: document.value, file: parsed.data },
      }
    : {
        outcome: "failed",
        error: {
          kind: "piece-invalid",
          path: request.piece.path,
          detail: z.prettifyError(parsed.error),
        },
      };
};

const modulesNamedIn = (request: { readonly settings: PieceModuleSettings }): readonly string[] =>
  [request.settings.module, request.settings.pluginModule].flatMap((module) =>
    module === undefined ? [] : [module],
  );

const pieceFolderOf = (request: { readonly path: string }): string =>
  request.path.slice(0, request.path.lastIndexOf("/"));

const pieceModuleEntries = (request: ParsedPiece): readonly string[] => {
  const folder = pieceFolderOf({ path: request.piece.path });
  const { kind, file } = request.file;
  if (kind === "legacy") {
    return file.clauses.flatMap(({ settings }) =>
      modulesNamedIn({ settings }).map((module) => `${folder}/${module}`),
    );
  }
  const { implementation, settings } = file;
  const mechanismFolder = pieceFolderOf({ path: pieceFolderOf({ path: folder }) });
  const moduleFolder =
    implementation === undefined
      ? folder
      : `${mechanismFolder}/${implementation.symptom}/${implementation.check}`;
  return settings === undefined
    ? []
    : modulesNamedIn({ settings }).map((module) => `${moduleFolder}/${module}`);
};

type MechanismImport = "by-package-name" | "by-path";

const mechanismImportOf = (request: ParsedPiece): MechanismImport =>
  PACKAGE_IMPORTED_MECHANISMS.has(
    (NAMED_PIECE_FILE.exec(request.piece.path) ?? PIECE_FILE.exec(request.piece.path))?.[1] ?? "",
  )
    ? "by-package-name"
    : "by-path";

const exportedModulesOf = (request: {
  readonly pieces: readonly ParsedPiece[];
}): readonly string[] => [
  ...new Set(
    request.pieces
      .filter((piece) => mechanismImportOf(piece) === "by-package-name")
      .flatMap(pieceModuleEntries)
      .map((path) => builtModulePath({ path })),
  ),
];

type JsonRecord = Readonly<Record<string, unknown>>;

const isRecord = (candidate: unknown): candidate is JsonRecord =>
  typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);

const builtSettingsOf = (request: { readonly settings: unknown }): unknown =>
  isRecord(request.settings)
    ? Object.fromEntries(
        Object.entries(request.settings).map(([key, setting]) => [
          key,
          PIECE_MODULE_KEYS.has(key) && typeof setting === "string"
            ? builtModulePath({ path: setting })
            : setting,
        ]),
      )
    : request.settings;

const builtClauseOf = (request: { readonly clause: unknown }): unknown =>
  isRecord(request.clause)
    ? Object.fromEntries(
        Object.entries(request.clause).map(([key, field]) => [
          key,
          key === "settings" ? builtSettingsOf({ settings: field }) : field,
        ]),
      )
    : request.clause;

const builtPieceOf = ({ document }: { readonly document: unknown }): unknown =>
  isRecord(document)
    ? Object.fromEntries(
        Object.entries(document).map(([key, field]) => [
          key,
          key === "clauses" && Array.isArray(field)
            ? field.map((clause: unknown) => builtClauseOf({ clause }))
            : key === "settings" && document.version === 2
              ? builtSettingsOf({ settings: field })
              : field,
        ]),
      )
    : document;

const builtPieceText = (request: { readonly document: unknown }): string =>
  `${JSON.stringify(builtPieceOf({ document: request.document }), null, 2)}\n`;

const parsedPieces = (request: {
  readonly pieces: readonly PieceText[];
}): Result<readonly ParsedPiece[], PlanFailure> =>
  request.pieces.reduce<Result<readonly ParsedPiece[], PlanFailure>>(
    (sofar, piece) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const parsed = parsedPieceOf({ piece });
      return parsed.outcome === "failed"
        ? parsed
        : { outcome: "ok", value: [...sofar.value, parsed.value] };
    },
    { outcome: "ok", value: [] },
  );

const copiedPathsIn = (request: { readonly sourcePaths: readonly string[] }): readonly string[] =>
  shippedPaths(request).filter(
    (path) =>
      SHIPPED_DOCUMENTS.has(path) ||
      documentAuthorOf({ path }) === "release" ||
      dataShippingOf({ path }) === "shipped",
  );

export const packagePlanOf = (request: {
  readonly sourcePaths: readonly string[];
  readonly pieces: readonly PieceText[];
}): Result<PackagePlan, PlanFailure> => {
  const pieces = parsedPieces({ pieces: request.pieces });
  if (pieces.outcome === "failed") {
    return pieces;
  }
  const runners = shippedPaths(request).filter((path) => RUNNER_ENTRY.test(path));
  const pieceModules = pieces.value.flatMap(pieceModuleEntries);
  return {
    outcome: "ok",
    value: {
      entryPoints: [
        ...new Set([
          COMMAND_SOURCE,
          ...PUBLIC_TYPE_ENTRIES.map((entry) => entry.source),
          ...runners,
          ...pieceModules,
        ]),
      ],
      command: builtModulePath({ path: COMMAND_SOURCE }),
      copied: copiedPathsIn(request),
      pieces: pieces.value.map(({ piece, document }) => ({
        path: piece.path,
        text: builtPieceText({ document }),
      })),
      exported: exportedModulesOf({ pieces: pieces.value }),
    },
  };
};

export const externalPackagesOf = (request: {
  readonly packages: readonly string[];
}): readonly string[] => request.packages.flatMap((name) => [name, `${name}/*`]);
