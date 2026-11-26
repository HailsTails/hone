import type { Engine, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { answeredFilesOf } from "../../../domain/records/answering/answered-files.ts";
import type {
  RecordsAtBase,
  RecordsReading,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { MappedRecordsDocument } from "../../../domain/records/upgrade/records-mapping.ts";
import { runFailureOf } from "../../../domain/report/run-failure.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { CheckedTree } from "../../../domain/repository/checked-tree.ts";
import { projectionOutputsOf } from "../../../domain/repository/projection-outputs.ts";
import type { Result } from "../../../domain/result.ts";
import type { ProjectedFile } from "../../../domain/runner/checks-run-report.ts";
import type { SettingsFile } from "../../../domain/settings/settings-file.ts";
import { SETTINGS_FILE_NAME } from "../../../domain/settings/settings-file.ts";
import type { CommandRequest } from "../../ports/command-request.ts";
import type { NamedEnginePort } from "../../ports/engine/engine-port.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import { moduleExtensionOf } from "../../ports/host/module-extension.ts";
import type { RecordsReader } from "../../ports/records/records-reader.ts";
import type { CheckPieceSourceOf, SettingsSourcesOf } from "../../ports/settings-sources.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import type { BoundCatalogueOf } from "../../ports/symptom-catalogue-repository.ts";
import type { ProjectionFailure } from "../../ports/upgrade/plan-refusal.ts";
import { checkedTreeOf } from "../../run/checked-tree-of.ts";
import { mapCataloguesToEngineChecks } from "../../run/engines/engine-checks.ts";
import { projectNamedEngines } from "../../run/engines/named-engines-run.ts";
import {
  catalogueWithExternalChecks,
  type NamedSettingsReading,
  readNamedSettingsFile,
} from "../../run/settings/read-settings.ts";
import { toolCatalogueOf } from "../../run/tool-catalogue.ts";
import type { ProjectionFilesOf } from "../proof/upgrade-plan.ts";

const BASE_NOT_GIVEN: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

export type PlannedProjectionPorts = {
  readonly directory: DirectoryPort;
  readonly recordsReader: Pick<RecordsReader, "recordsReadingOf">;
  readonly boundCatalogueOf: BoundCatalogueOf;
  readonly settingsFormat: SettingsFileFormat;
  readonly settingsSourcesOf: SettingsSourcesOf;
  readonly checkPieceSourceOf: CheckPieceSourceOf;
  readonly namedEngine: NamedEnginePort;
};

type Context = PlannedProjectionPorts & {
  readonly command: Pick<CommandRequest, "fileText" | "git" | "moduleUrl" | "modules" | "path">;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

const refusedBy = (request: {
  readonly failure: RunLoadFailure;
}): Result<never, ProjectionFailure> => ({
  outcome: "failed",
  error: { kind: "projection-failed", failure: request.failure },
});

const settingsReadingOf = (
  request: Context & { readonly settings: SettingsFile; readonly catalogue: SymptomCatalogue },
): Result<NamedSettingsReading, ProjectionFailure> => {
  const { command, repoRoot, installRoot, settings, catalogue } = request;
  const at = {
    fileText: command.fileText,
    directory: request.directory,
    path: command.path,
    repoRoot,
    installRoot,
    moduleExtension: moduleExtensionOf({ moduleUrl: command.moduleUrl }),
    toolRecordKinds: catalogue.recordKinds,
  };
  const read = readNamedSettingsFile({
    sources: request.settingsSourcesOf(at),
    readPiece: request.checkPieceSourceOf(at),
    file: settings,
    path: SETTINGS_FILE_NAME,
  });
  return read.outcome === "failed"
    ? refusedBy({ failure: runFailureOf({ engines: catalogue.engines, source: read.error }) })
    : read;
};

const recordsReadingFor = (request: {
  readonly recordsReader: Pick<RecordsReader, "recordsReadingOf">;
  readonly documents: readonly MappedRecordsDocument[];
  readonly catalogue: SymptomCatalogue;
}): Result<RecordsReading, ProjectionFailure> => {
  const read = request.recordsReader.recordsReadingOf({
    documents: request.documents.map(({ file, version, records }) => ({
      file,
      document: { version, records },
    })),
    catalogue: request.catalogue,
    base: BASE_NOT_GIVEN,
  });
  return read.outcome === "failed"
    ? refusedBy({
        failure: runFailureOf({
          engines: request.catalogue.engines,
          source: { kind: "records-documents", refusals: read.error },
        }),
      })
    : read;
};

const treeOf = (
  request: Context & { readonly settings: NamedSettingsReading },
): Result<CheckedTree, ProjectionFailure> => {
  const { command, repoRoot, settings } = request;
  const tree = checkedTreeOf({
    git: command.git,
    fileText: command.fileText,
    path: command.path,
    repoRoot,
    excluded: settings.selection.excluded,
    eslintConfigRoots: settings.selection.eslintConfigRoots,
  });
  return tree.outcome === "failed"
    ? refusedBy({ failure: runFailureOf({ engines: [], source: tree.error }) })
    : tree;
};

const fileNameOf = (request: { readonly file: string }): string =>
  request.file.slice(request.file.lastIndexOf("/") + 1);

const projectionsAmong = (request: {
  readonly files: readonly ProjectedFile[];
  readonly engines: readonly Engine[];
}): readonly ProjectedFile[] => {
  const names = request.engines.map(
    (engine) => projectionOutputsOf({ engineName: engine.name, kind: "mjs" }).configuration,
  );
  return request.files.filter(({ file }) => names.includes(fileNameOf({ file })));
};

export const plannedProjectionOf =
  (context: Context): ProjectionFilesOf =>
  async ({ settings, documents }) => {
    const { command, repoRoot, installRoot } = context;
    const catalogue = toolCatalogueOf({
      fileText: command.fileText,
      path: command.path,
      installRoot,
      boundCatalogueOf: context.boundCatalogueOf,
    });
    if (catalogue.outcome === "failed") {
      return refusedBy({ failure: catalogue.error });
    }
    const planned = settingsReadingOf({ ...context, settings, catalogue: catalogue.value });
    if (planned.outcome === "failed") {
      return planned;
    }
    const effectiveCatalogue = catalogueWithExternalChecks({
      catalogue: catalogue.value,
      settings: planned.value,
    });
    const checks = mapCataloguesToEngineChecks({ catalogues: [effectiveCatalogue] });
    if (checks.outcome === "failed") {
      return refusedBy({ failure: checks.error });
    }
    const records = recordsReadingFor({
      recordsReader: context.recordsReader,
      documents,
      catalogue: effectiveCatalogue,
    });
    if (records.outcome === "failed") {
      return records;
    }
    const tree = treeOf({ ...context, settings: planned.value });
    if (tree.outcome === "failed") {
      return tree;
    }
    const projected = await projectNamedEngines({
      checks: checks.value,
      settings: planned.value,
      answered: answeredFilesOf({ records: records.value.records }),
      tree: tree.value,
      repoRoot,
      installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: command.moduleUrl }),
      path: command.path,
      modules: command.modules,
      engine: context.namedEngine,
    });
    if (projected.outcome === "failed") {
      return refusedBy({
        failure: runFailureOf({ engines: catalogue.value.engines, source: projected.error }),
      });
    }
    const files = projected.value.filter((entry) => entry.kind === "write");
    return {
      outcome: "ok",
      value: {
        files: files.map(({ file, text }) => ({ file, text })),
        projections: projectionsAmong({ files, engines: catalogue.value.engines }).map(
          ({ file, text }) => ({ file, text }),
        ),
      },
    };
  };
