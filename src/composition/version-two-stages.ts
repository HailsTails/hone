import type { NamedEnginePort } from "../application/ports/engine/engine-port.ts";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleExtension } from "../application/ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import type { SettingsSourcesOf } from "../application/ports/settings-sources.ts";
import { readHoneRecords } from "../application/records/read-hone-records.ts";
import { type CheckedTree, checkedTreeOf } from "../application/run/checked-tree-of.ts";
import {
  type NamedEnginesRequest,
  namedEngineProjectionsOf,
  namedEngineRunsOf,
} from "../application/run/engines/named-engines-run.ts";
import {
  readNamedSettings,
  type NamedSettingsReading,
} from "../application/run/settings/read-settings.ts";
import { toolCatalogueOf } from "../application/run/tool-catalogue.ts";
import { renamedSinceBaseOf } from "../application/run/touched-set/renamed-since-base.ts";
import { touchedSetOf } from "../application/run/touched-set/touched-set-of.ts";
import type { EngineStageRequest, VersionTwoStages } from "../application/run/version-two-run.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import { answeredFilesOf } from "../domain/records/answering/answered-files.ts";
import type { RecordsReading } from "../domain/records/hone-records/hone-record.ts";
import type { RunFailureSource } from "../domain/report/run-failure.ts";
import { runFailureOf } from "../domain/report/run-failure.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import { createBoundCatalogueOf } from "../infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { SETTINGS_FILE_FORMAT } from "../infrastructure/hone-config-file/settings-file.ts";
import { createCheckPieceSource } from "../infrastructure/hone-config-file/settings-sources.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";

export type VersionTwoPorts = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
  readonly namedEngine: NamedEnginePort;
  readonly git: GitPort;
  readonly gitTree: GitTreePort;
  readonly directory: DirectoryPort;
  readonly recordsSourceOf: RecordsSourceOf;
  readonly settingsSourcesOf: SettingsSourcesOf;
};

export type VersionTwoLocations = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly baseRevision: string | undefined;
};

type StagesRequest = { readonly ports: VersionTwoPorts; readonly locations: VersionTwoLocations };

export type StagesOver = (request: StagesRequest) => VersionTwoStages;

const settingsStage = (
  request: StagesRequest & { readonly catalogue: SymptomCatalogue },
): Result<NamedSettingsReading, RunLoadFailure> => {
  const { fileText, path } = request.ports;
  const { repoRoot, installRoot, moduleExtension } = request.locations;
  const read = readNamedSettings({
    sources: request.ports.settingsSourcesOf({
      fileText,
      directory: request.ports.directory,
      path,
      repoRoot,
      installRoot,
      moduleExtension,
      toolRecordKinds: request.catalogue.recordKinds,
    }),
    readPiece: createCheckPieceSource({ fileText, path, installRoot, moduleExtension }),
    settingsFormat: SETTINGS_FILE_FORMAT,
  });
  return read.outcome === "failed"
    ? {
        outcome: "failed",
        error: runFailureOf({ engines: request.catalogue.engines, source: read.error }),
      }
    : read;
};

const recordsStage = (
  request: StagesRequest & { readonly catalogue: SymptomCatalogue },
): Result<RecordsReading, RunLoadFailure> => {
  const { fileText, directory, git, gitTree, recordsSourceOf } = request.ports;
  const read = readHoneRecords({
    source: recordsSourceOf({
      fileText,
      directory,
      git,
      gitTree,
      repoRoot: request.locations.repoRoot,
      catalogue: request.catalogue,
    }),
    recordsReader,
    catalogue: request.catalogue,
    baseRevision: request.locations.baseRevision,
  });
  return read.outcome === "failed"
    ? {
        outcome: "failed",
        error: runFailureOf({ engines: request.catalogue.engines, source: read.error }),
      }
    : read;
};

const treeStage = (
  request: StagesRequest & { readonly settings: NamedSettingsReading },
): Result<CheckedTree, RunLoadFailure> => {
  const { git, fileText, path } = request.ports;
  const tree = checkedTreeOf({
    git,
    fileText,
    path,
    repoRoot: request.locations.repoRoot,
    excluded: request.settings.selection.excluded,
    eslintConfigRoots: request.settings.selection.eslintConfigRoots,
  });
  return tree.outcome === "failed"
    ? { outcome: "failed", error: runFailureOf({ engines: [], source: tree.error }) }
    : tree;
};

const enginesRequestOf = (
  request: StagesRequest & { readonly stage: EngineStageRequest },
): NamedEnginesRequest => ({
  ...request.stage,
  repoRoot: request.locations.repoRoot,
  installRoot: request.locations.installRoot,
  moduleExtension: request.locations.moduleExtension,
  path: request.ports.path,
  modules: request.ports.modules,
  engine: request.ports.namedEngine,
  checks: request.stage.catalogue.checks,
  answered: answeredFilesOf({ records: request.stage.records.records }),
});

const runtimeOutcome = <Value>(request: {
  readonly outcome: Result<Value, RunFailureSource>;
  readonly catalogue: SymptomCatalogue;
}): Result<Value, RunLoadFailure> =>
  request.outcome.outcome === "ok"
    ? request.outcome
    : {
        outcome: "failed",
        error: runFailureOf({ engines: request.catalogue.engines, source: request.outcome.error }),
      };

export const versionTwoStagesOver = (request: StagesRequest): VersionTwoStages => ({
  catalogue: () =>
    toolCatalogueOf({
      fileText: request.ports.fileText,
      path: request.ports.path,
      installRoot: request.locations.installRoot,
      boundCatalogueOf: createBoundCatalogueOf({ directory: request.ports.directory }),
    }),
  settings: (stage) => settingsStage({ ...request, ...stage }),
  records: (stage) => recordsStage({ ...request, ...stage }),
  tree: (stage) => treeStage({ ...request, ...stage }),
  engines: async (stage) =>
    runtimeOutcome({
      catalogue: stage.catalogue,
      outcome: await namedEngineRunsOf(enginesRequestOf({ ...request, stage })),
    }),
  projections: async (stage) =>
    runtimeOutcome({
      catalogue: stage.catalogue,
      outcome: await namedEngineProjectionsOf(enginesRequestOf({ ...request, stage })),
    }),
  renamed: () =>
    renamedSinceBaseOf({
      repoRoot: request.locations.repoRoot,
      baseRevision: request.locations.baseRevision,
      git: request.ports.git,
    }),
  touched: (stage) =>
    touchedSetOf({
      assessment: stage.assessment,
      measuring: stage.measuring,
      records: stage.records.records,
      repoRoot: request.locations.repoRoot,
      baseRevision: request.locations.baseRevision,
      git: request.ports.git,
      renamed: stage.renamed,
    }),
});

export const createChildMeasuredStagesOver =
  (options: {
    readonly createEngines: (
      locations: VersionTwoLocations & { readonly path: PathPort },
    ) => VersionTwoStages["engines"];
  }): StagesOver =>
  (request) => ({
    ...versionTwoStagesOver(request),
    engines: options.createEngines({
      path: request.ports.path,
      installRoot: request.locations.installRoot,
      repoRoot: request.locations.repoRoot,
      moduleExtension: request.locations.moduleExtension,
      baseRevision: request.locations.baseRevision,
    }),
  });
