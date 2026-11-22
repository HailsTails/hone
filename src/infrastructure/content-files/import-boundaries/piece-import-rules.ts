import { pieceTypePackagesSchema } from "./piece-type-packages-schema.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { parsedJson } from "../rule-sets/rule-set-reader.ts";
import { isCatalogueName } from "../../../domain/language-layer/catalogue-name.ts";
import type { CheckNames } from "../../../domain/language-layer/check-address-text.ts";
import { enginesFolderSegmentsOf, namedPieceFolderSegmentsOf, pieceFolderSegmentsOf } from "../../../domain/rule-set/piece-folder.ts";
import type { DisciplineId, EngineId } from "../../../domain/rule-set/identifier-types.ts";
import { isDisciplineId } from "../../../domain/rule-set/identifiers.ts";
import { engineIdSchema, versionOneEngineIdSchema } from "../../hone-config-file/identifiers.ts";
import type { Result } from "../../../domain/result.ts";

export type PieceLocation = {
  readonly file: string;
  readonly ruleSetRoot: string;
  readonly mechanism: EngineId;
} & ({ readonly discipline: DisciplineId } | CheckNames);

export type PieceImportRefusal = {
  readonly specifier: string;
  readonly reason: "outside-piece-reach" | "value-import-of-package" | "package-not-listed" | "dynamic-import";
};

export type FileImportRefusal = PieceImportRefusal & { readonly file: string };

export type PieceImportFindings = {
  readonly pieces: readonly PieceLocation[];
  readonly refusals: readonly FileImportRefusal[];
};

export type PieceImportFindingsFailure =
  | { readonly kind: "type-packages-missing"; readonly path: string }
  | { readonly kind: "type-packages-malformed"; readonly path: string; readonly detail: string }
  | { readonly kind: "unknown-mechanism"; readonly file: string; readonly mechanism: string }
  | { readonly kind: "not-a-discipline"; readonly file: string; readonly folder: string };

export type ImportForm = "type-only" | "value" | "dynamic";

export type ModuleImport = { readonly specifier: string; readonly form: ImportForm };

const IMPORT_STATEMENT = /^\s*(?:import|export)\s+(type\s+)?(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/gm;

const DYNAMIC_MODULE_LOAD = /\b(?:import|require)\s*\(\s*([^)]*?)\s*\)/g;

const QUOTED = /^(["'])(.*)\1$/;

type PlacedImport = ModuleImport & { readonly position: number };

export const importsIn = (request: { readonly text: string }): readonly ModuleImport[] =>
  [
    ...[...request.text.matchAll(IMPORT_STATEMENT)].map(
      (match): PlacedImport => ({
        specifier: match[2],
        form: match[1] === undefined ? "value" : "type-only",
        position: match.index,
      }),
    ),
    ...[...request.text.matchAll(DYNAMIC_MODULE_LOAD)].map(
      (match): PlacedImport => ({
        specifier: match[1].replace(QUOTED, "$2"),
        form: "dynamic",
        position: match.index,
      }),
    ),
  ]
    .toSorted((first, second) => first.position - second.position)
    .map((placed) => ({ specifier: placed.specifier, form: placed.form }));

const normalisedOf = (request: { readonly text: string }): string =>
  request.text === "." ? "" : request.text.replace(/^(?:\.\/)+/, "");

const folderPrefixOf = (request: { readonly root: string }): string => {
  const root = normalisedOf({ text: request.root });
  return root === "" ? "" : `${root}/`;
};

const RUNNER_FOLDER = "runner";

const pieceLocationOf = (request: {
  readonly file: string;
  readonly ruleSetRoot: string;
  readonly installRoot: string;
}): Result<readonly PieceLocation[], PieceImportFindingsFailure> => {
  const enginesFolder = enginesFolderSegmentsOf({
    ruleSetRoot: normalisedOf({ text: request.ruleSetRoot }),
    installRoot: normalisedOf({ text: request.installRoot }),
  }).join("/");
  const prefix = `${folderPrefixOf({ root: request.ruleSetRoot })}${enginesFolder}/`;
  const file = normalisedOf({ text: request.file });
  if (!file.startsWith(prefix) || file.endsWith(".test.ts") || !file.endsWith(".ts")) {
    return { outcome: "ok", value: [] };
  }
  const [mechanismText, discipline, ...rest] = file.slice(prefix.length).split("/");
  if (mechanismText === undefined || discipline === undefined || rest.length === 0 || discipline === RUNNER_FOLDER) {
    return { outcome: "ok", value: [] };
  }
  const engineSchema = request.ruleSetRoot === request.installRoot ? engineIdSchema : versionOneEngineIdSchema;
  const mechanism = engineSchema.safeParse(mechanismText);
  const [check, ...sources] = rest;
  if (mechanism.success && isCatalogueName(discipline) && check !== undefined && isCatalogueName(check) && sources.length > 0) {
    return { outcome: "ok", value: [{ file: request.file, ruleSetRoot: request.ruleSetRoot, mechanism: mechanism.data, symptom: discipline, check }] };
  }
  if (!isDisciplineId(discipline)) {
    return mechanism.success
      ? { outcome: "failed", error: { kind: "not-a-discipline", file: request.file, folder: discipline } }
      : { outcome: "ok", value: [] };
  }
  return mechanism.success
    ? { outcome: "ok", value: [{ file: request.file, ruleSetRoot: request.ruleSetRoot, mechanism: mechanism.data, discipline }] }
    : { outcome: "failed", error: { kind: "unknown-mechanism", file: request.file, mechanism: mechanismText } };
};

export const pieceFilesOf = (request: {
  readonly trackedPaths: readonly string[];
  readonly ruleSetRoots: readonly string[];
  readonly installRoot: string;
}): Result<readonly PieceLocation[], PieceImportFindingsFailure> => {
  const located = request.trackedPaths.map((file) => locationOfFile({ file, ruleSetRoots: request.ruleSetRoots, installRoot: request.installRoot }));
  const failed = located.find((location) => location.outcome === "failed");
  return failed ?? { outcome: "ok", value: located.flatMap((location) => (location.outcome === "ok" ? location.value : [])) };
};

const locationOfFile = (request: {
  readonly file: string;
  readonly ruleSetRoots: readonly string[];
  readonly installRoot: string;
}): Result<readonly PieceLocation[], PieceImportFindingsFailure> => {
  const attempts = request.ruleSetRoots.map((ruleSetRoot) =>
    pieceLocationOf({ file: request.file, ruleSetRoot, installRoot: request.installRoot }),
  );
  return attempts.find((attempt) => attempt.outcome === "failed" || attempt.value.length > 0) ?? { outcome: "ok", value: [] };
};

const specifierKindOf = (request: { readonly specifier: string }): "relative" | "package" =>
  request.specifier.startsWith("./") || request.specifier.startsWith("../") ? "relative" : "package";

const relativeRefusal = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly piece: PieceLocation;
  readonly specifier: string;
}): readonly PieceImportRefusal[] => {
  const target = request.path.joinRepository({
    segments: [request.path.repositoryDirectoryOf({ path: request.piece.file }), request.specifier],
  });
  const location = { ...request.piece, installRoot: request.installRoot };
  const localReach = "symptom" in location
    ? [namedPieceFolderSegmentsOf(location), [location.ruleSetRoot, "rules", "typescript", "symptoms", location.symptom]]
    : [pieceFolderSegmentsOf(location), [location.ruleSetRoot, "rules", location.discipline]];
  const reach = [
    ...localReach,
    [request.installRoot, "src", "infrastructure", "engines", request.piece.mechanism, "runner"],
    [request.installRoot, "src", "domain"],
    [request.installRoot, "src", "application", "ports"],
    [request.installRoot, "src", "infrastructure", "content-files"],
    [request.installRoot, "src", "infrastructure", "discipline-exceptions-folder"],
  ].map((segments) => `${request.path.joinRepository({ segments })}/`);
  return reach.some((folder) => target.startsWith(folder))
    ? []
    : [{ specifier: request.specifier, reason: "outside-piece-reach" }];
};

const packageRefusal = (request: {
  readonly moduleImport: ModuleImport;
  readonly typePackages: readonly string[];
}): readonly PieceImportRefusal[] => {
  if (request.moduleImport.form === "value") {
    return [{ specifier: request.moduleImport.specifier, reason: "value-import-of-package" }];
  }
  return request.typePackages.includes(request.moduleImport.specifier)
    ? []
    : [{ specifier: request.moduleImport.specifier, reason: "package-not-listed" }];
};

const dynamicRefusal = (request: { readonly specifier: string }): readonly PieceImportRefusal[] => [
  { specifier: request.specifier, reason: "dynamic-import" },
];

const importRefusal = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly piece: PieceLocation;
  readonly moduleImport: ModuleImport;
  readonly typePackages: readonly string[];
}): readonly PieceImportRefusal[] => {
  const specifier = request.moduleImport.specifier;
  if (request.moduleImport.form === "dynamic") {
    return dynamicRefusal({ specifier });
  }
  if (specifierKindOf({ specifier }) === "relative") {
    return relativeRefusal({ path: request.path, installRoot: request.installRoot, piece: request.piece, specifier });
  }
  return packageRefusal({ moduleImport: request.moduleImport, typePackages: request.typePackages });
};

export const pieceImportRefusals = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly piece: PieceLocation;
  readonly source: string;
  readonly typePackages: readonly string[];
}): readonly PieceImportRefusal[] =>
  importsIn({ text: request.source }).flatMap((moduleImport) => importRefusal({ ...request, moduleImport }));

type TypePackagesByMechanism = Readonly<Record<string, readonly string[]>>;

const typePackagesOf = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly mechanism: string;
  readonly typePackageTexts: Readonly<Record<string, string>>;
}): Result<readonly string[], PieceImportFindingsFailure> => {
  const listPath = request.path.joinRepository({
    segments: [request.installRoot, "src", "infrastructure", "engines", request.mechanism, "runner", "piece-type-packages.json"],
  });
  const text = Object.entries(request.typePackageTexts).find(
    ([key]) => request.path.joinRepository({ segments: [key] }) === listPath,
  );
  if (text === undefined) {
    return { outcome: "failed", error: { kind: "type-packages-missing", path: listPath } };
  }
  const json = parsedJson({ text: text[1] });
  if (json.outcome === "failed") {
    return { outcome: "failed", error: { kind: "type-packages-malformed", path: listPath, detail: json.error } };
  }
  const parsed = pieceTypePackagesSchema.safeParse(json.value);
  if (!parsed.success) {
    return { outcome: "failed", error: { kind: "type-packages-malformed", path: listPath, detail: parsed.error.message } };
  }
  return { outcome: "ok", value: parsed.data };
};

const typePackagesByMechanism = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly pieces: readonly PieceLocation[];
  readonly typePackageTexts: Readonly<Record<string, string>>;
}): Result<TypePackagesByMechanism, PieceImportFindingsFailure> =>
  [...new Set(request.pieces.map((piece) => piece.mechanism))].reduce<
    Result<TypePackagesByMechanism, PieceImportFindingsFailure>
  >((collected, mechanism) => withTypePackages({ ...request, collected, mechanism }), { outcome: "ok", value: {} });

const withTypePackages = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly typePackageTexts: Readonly<Record<string, string>>;
  readonly collected: Result<TypePackagesByMechanism, PieceImportFindingsFailure>;
  readonly mechanism: string;
}): Result<TypePackagesByMechanism, PieceImportFindingsFailure> => {
  if (request.collected.outcome === "failed") {
    return request.collected;
  }
  const listed = typePackagesOf(request);
  if (listed.outcome === "failed") {
    return listed;
  }
  return { outcome: "ok", value: { ...request.collected.value, [request.mechanism]: listed.value } };
};

const refusalsIn = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly pieces: readonly PieceLocation[];
  readonly file: string;
  readonly source: string;
  readonly packages: TypePackagesByMechanism;
}): readonly FileImportRefusal[] =>
  request.pieces
    .filter((piece) => piece.file === request.file)
    .flatMap((piece) =>
      pieceImportRefusals({ ...request, piece, typePackages: request.packages[piece.mechanism] }).map((refusal) => ({
        file: request.file,
        ...refusal,
      })),
    );

export const pieceImportFindings = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly ruleSetRoots: readonly string[];
  readonly sources: Readonly<Record<string, string>>;
  readonly typePackageTexts: Readonly<Record<string, string>>;
}): Result<PieceImportFindings, PieceImportFindingsFailure> => {
  const located = pieceFilesOf({
    trackedPaths: Object.keys(request.sources),
    ruleSetRoots: request.ruleSetRoots,
    installRoot: request.installRoot,
  });
  if (located.outcome === "failed") {
    return located;
  }
  const pieces = located.value;
  const packages = typePackagesByMechanism({ ...request, pieces });
  if (packages.outcome === "failed") {
    return packages;
  }
  return {
    outcome: "ok",
    value: {
      pieces,
      refusals: Object.entries(request.sources).flatMap(([file, source]) =>
        refusalsIn({ ...request, pieces, file, source, packages: packages.value }),
      ),
    },
  };
};
