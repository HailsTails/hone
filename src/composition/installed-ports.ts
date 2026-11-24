import { shownPathOfRepository } from "../infrastructure/command-line/installation/shown-path.ts";
import { createBoundCatalogueOf } from "../infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { versionOneAwareRecordsSourceOf } from "../infrastructure/discipline-exceptions-folder/base-standing-records-source.ts";
import { exceptionRepositoryOf } from "../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { exceptionEntryParser } from "../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { foundTreeRecordsSourceOf } from "../infrastructure/discipline-exceptions-folder/found-tree-records-source.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { runnerModuleAt } from "../infrastructure/engines/protocol/runner-module/runner-module-at.ts";
import { SETTINGS_FILE_FORMAT } from "../infrastructure/hone-config-file/settings-file.ts";
import {
  createCheckPieceSource,
  createSettingsSources,
} from "../infrastructure/hone-config-file/settings-sources.ts";
import { createRecordsFolder } from "../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "../infrastructure/hone-records-folder/writing/records-edit.ts";
import { loadFailureDetail } from "../infrastructure/printed-report/load-failures/load-failure-text.ts";
import { runnerEnginesOver } from "./runner-engines.ts";
import type { ToolPorts } from "./tool-ports.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

export type NodePorts = Pick<
  ToolPorts,
  | "path"
  | "fileText"
  | "modules"
  | "git"
  | "gitTree"
  | "directory"
  | "fileCreation"
  | "fileRemoval"
  | "directoryRemoval"
  | "entryKind"
>;

export const installedPortsOver = (node: NodePorts): ToolPorts => {
  const exceptionRepositories = exceptionRepositoryOf({
    fileText: node.fileText,
    path: node.path,
    directory: node.directory,
    fileRemoval: node.fileRemoval,
    git: node.git,
    gitTree: node.gitTree,
  });
  return {
    ...node,
    ...runnerEnginesOver({ runnerModuleOf: runnerModuleAt }),
    exceptionRepositoryOf: exceptionRepositories,
    exceptionEntryParser,
    selectionRepositoryOf: createSelectionRepository,
    shownPathOfRepository,
    stagesOver: versionTwoStagesOver,
    recordsSourceOf: versionOneAwareRecordsSourceOf({
      recordsSourceOf: createRecordsFolder,
      exceptionRepositoryOf: exceptionRepositories,
    }),
    recordsReader,
    recordsEditor,
    foundTreeRecordsSourceOf,
    loadFailureDetail,
    boundCatalogueOf: createBoundCatalogueOf({ directory: node.directory }),
    settingsFormat: SETTINGS_FILE_FORMAT,
    settingsSourcesOf: createSettingsSources,
    checkPieceSourceOf: createCheckPieceSource,
  };
};
