import type { CommandRequest } from "../../ports/command-request.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { RecordsAtBase, RecordsReading } from "../../../domain/records/hone-records/hone-record.ts";
import { recordsReadingOf } from "../../../infrastructure/hone-records-folder/reading/records-reading.ts";
import { type CheckedTree, checkedTreeOf } from "../../run/checked-tree-of.ts";
import { enginesProjectionOf } from "../../run/engines/engines-run.ts";
import { runFailureOf } from "../../../domain/report/run-failure.ts";
import { toolCatalogueOf } from "../../run/tool-catalogue.ts";
import { type SettingsReading, readSettings } from "../../run/settings/read-settings.ts";
import { settingsWireOf } from "../../../infrastructure/hone-config-file/settings-file.ts";
import type { SettingsFile } from "../../../domain/settings/settings-file.ts";
import { createSettingsSources } from "../../../infrastructure/hone-config-file/settings-sources.ts";
import { SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { Engine, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { moduleExtensionOf } from "../../../infrastructure/node/modules/install-layout.ts";
import { projectionOutputsOf } from "../../../domain/repository/projection-outputs.ts";
import type { Result } from "../../../domain/result.ts";
import type { MappedRecordsDocument } from "../../../domain/records/upgrade/records-mapping.ts";
import type { ProjectionFailure, ProjectionFilesOf } from "../proof/upgrade-plan.ts";

const BASE_NOT_GIVEN: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

type Context = {
  readonly command: CommandRequest;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

const refusedBy = (request: { readonly failure: RunLoadFailure }): Result<never, ProjectionFailure> => ({
  outcome: "failed",
  error: { kind: "projection-failed", failure: request.failure },
});

const settingsReadingOf = (request: Context & { readonly settings: SettingsFile; readonly catalogue: SymptomCatalogue }): Result<SettingsReading, ProjectionFailure> => {
  const { command, repoRoot, installRoot, settings, catalogue } = request;
  const real = createSettingsSources({ fileText: command.fileText, path: command.path, repoRoot, installRoot, moduleExtension: moduleExtensionOf({ moduleUrl: command.moduleUrl }) });
  const read = readSettings({ sources: { ...real, settingsFile: () => ({ outcome: "ok", value: { path: SETTINGS_FILE_NAME, document: settingsWireOf({ settings }) } }) } });
  return read.outcome === "failed" ? refusedBy({ failure: runFailureOf({ engines: catalogue.engines, source: read.error }) }) : read;
};

const recordsReadingFor = (request: { readonly documents: readonly MappedRecordsDocument[]; readonly catalogue: SymptomCatalogue }): Result<RecordsReading, ProjectionFailure> => {
  const read = recordsReadingOf({
    documents: request.documents.map(({ file, version, records }) => ({ file, document: { version, records } })),
    catalogue: request.catalogue,
    base: BASE_NOT_GIVEN,
  });
  return read.outcome === "failed"
    ? refusedBy({ failure: runFailureOf({ engines: request.catalogue.engines, source: { kind: "records-documents", refusals: read.error } }) })
    : read;
};

const treeOf = (request: Context & { readonly settings: SettingsReading }): Result<CheckedTree, ProjectionFailure> => {
  const { command, repoRoot, settings } = request;
  const tree = checkedTreeOf({
    git: command.git,
    fileText: command.fileText,
    path: command.path,
    repoRoot,
    excluded: settings.selection.excluded,
    eslintConfigRoots: settings.selection.eslintConfigRoots,
  });
  return tree.outcome === "failed" ? refusedBy({ failure: runFailureOf({ engines: [], source: tree.error }) }) : tree;
};

const fileNameOf = (request: { readonly file: string }): string => request.file.slice(request.file.lastIndexOf("/") + 1);

const projectionsAmong = (request: { readonly files: readonly ProjectedFile[]; readonly engines: readonly Engine[] }): readonly ProjectedFile[] => {
  const names = request.engines.map((engine) => projectionOutputsOf({ engineName: engine.name }).configuration);
  return request.files.filter(({ file }) => names.includes(fileNameOf({ file })));
};

export const plannedProjectionOf =
  (context: Context): ProjectionFilesOf =>
  async ({ settings, documents }) => {
    const { command, repoRoot, installRoot } = context;
    const catalogue = toolCatalogueOf({ fileText: command.fileText, path: command.path, installRoot });
    if (catalogue.outcome === "failed") {
      return refusedBy({ failure: catalogue.error });
    }
    const planned = settingsReadingOf({ ...context, settings, catalogue: catalogue.value });
    if (planned.outcome === "failed") {
      return planned;
    }
    const records = recordsReadingFor({ documents, catalogue: catalogue.value });
    if (records.outcome === "failed") {
      return records;
    }
    const tree = treeOf({ ...context, settings: planned.value });
    if (tree.outcome === "failed") {
      return tree;
    }
    const projected = await enginesProjectionOf({
      catalogue: catalogue.value,
      settings: planned.value,
      records: records.value,
      tree: tree.value,
      repoRoot,
      installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: command.moduleUrl }),
      path: command.path,
      modules: command.modules,
    });
    return projected.outcome === "failed"
      ? refusedBy({ failure: projected.error })
      : { outcome: "ok", value: { files: projected.value, projections: projectionsAmong({ files: projected.value, engines: catalogue.value.engines }) } };
  };
