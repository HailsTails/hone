import type { DirectoryPort } from "./infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "./infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import type { PathPort } from "./infrastructure/node/path-port.ts";
import type { RecordsSourceOf } from "./infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { readHoneRecords } from "./application/records/read-hone-records.ts";
import type { RecordsReading } from "./domain/records/hone-records/hone-record.ts";
import type { RunLoadFailure } from "./domain/report/run-load-failure.ts";
import { createSettingsRepository, type SettingsReading } from "./application/run/settings/read-settings.ts";
import { createSettingsSources } from "./infrastructure/hone-config-file/settings-sources.ts";
import type { SymptomCatalogue } from "./domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "./domain/repository/absolute-path-types.ts";
import type { ModuleExtension } from "./infrastructure/node/modules/install-layout.ts";
import type { Result } from "./domain/result.ts";
import { type CheckedTree, checkedTreeOf } from "./application/run/checked-tree-of.ts";
import { type EnginesRunRequest, enginesProjectionOf, enginesRunOf } from "./application/run/engines/engines-run.ts";
import { runFailureOf } from "./domain/report/run-failure.ts";
import { toolCatalogueOf } from "./application/run/tool-catalogue.ts";
import { touchedSetOf } from "./application/run/touched-set/touched-set-of.ts";
import type { EngineStageRequest, VersionTwoStages } from "./application/run/version-two-run.ts";

export type VersionTwoPorts = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
  readonly gitTree: GitTreePort;
  readonly directory: DirectoryPort;
  readonly recordsSourceOf: RecordsSourceOf;
};

export type VersionTwoLocations = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly baseRevision: string | undefined;
};

type StagesRequest = { readonly ports: VersionTwoPorts; readonly locations: VersionTwoLocations };

const settingsStage = (request: StagesRequest & { readonly catalogue: SymptomCatalogue }): Result<SettingsReading, RunLoadFailure> => {
  const { fileText, path } = request.ports;
  const { repoRoot, installRoot, moduleExtension } = request.locations;
  const read = createSettingsRepository({ sources: createSettingsSources({ fileText, path, repoRoot, installRoot, moduleExtension }) }).read({});
  return read.outcome === "failed" ? { outcome: "failed", error: runFailureOf({ engines: request.catalogue.engines, source: read.error }) } : read;
};

const recordsStage = (request: StagesRequest & { readonly catalogue: SymptomCatalogue }): Result<RecordsReading, RunLoadFailure> => {
  const { fileText, path, directory, git, gitTree, recordsSourceOf } = request.ports;
  const read = readHoneRecords({
    source: recordsSourceOf({ fileText, path, directory, git, gitTree, repoRoot: request.locations.repoRoot, catalogue: request.catalogue }),
    catalogue: request.catalogue,
    baseRevision: request.locations.baseRevision,
  });
  return read.outcome === "failed" ? { outcome: "failed", error: runFailureOf({ engines: request.catalogue.engines, source: read.error }) } : read;
};

const treeStage = (request: StagesRequest & { readonly settings: SettingsReading }): Result<CheckedTree, RunLoadFailure> => {
  const { git, fileText, path } = request.ports;
  const tree = checkedTreeOf({
    git,
    fileText,
    path,
    repoRoot: request.locations.repoRoot,
    excluded: request.settings.selection.excluded,
    eslintConfigRoots: request.settings.selection.eslintConfigRoots,
  });
  return tree.outcome === "failed" ? { outcome: "failed", error: runFailureOf({ engines: [], source: tree.error }) } : tree;
};

const enginesRequestOf = (request: StagesRequest & { readonly stage: EngineStageRequest }): EnginesRunRequest => ({
  ...request.stage,
  repoRoot: request.locations.repoRoot,
  installRoot: request.locations.installRoot,
  moduleExtension: request.locations.moduleExtension,
  path: request.ports.path,
  modules: request.ports.modules,
});

export const versionTwoStagesOver = (request: StagesRequest): VersionTwoStages => ({
  catalogue: () => toolCatalogueOf({ fileText: request.ports.fileText, path: request.ports.path, installRoot: request.locations.installRoot }),
  settings: (stage) => settingsStage({ ...request, ...stage }),
  records: (stage) => recordsStage({ ...request, ...stage }),
  tree: (stage) => treeStage({ ...request, ...stage }),
  engines: (stage) => enginesRunOf(enginesRequestOf({ ...request, stage })),
  projections: (stage) => enginesProjectionOf(enginesRequestOf({ ...request, stage })),
  touched: (stage) =>
    touchedSetOf({ assessment: stage.assessment, measuring: stage.measuring, records: stage.records.records, repoRoot: request.locations.repoRoot, baseRevision: request.locations.baseRevision, git: request.ports.git }),
});
