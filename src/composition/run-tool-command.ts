import { SETTINGS_FILE_FORMAT } from "../infrastructure/hone-config-file/settings-file.ts";
import { createDefaultDirectoryPort, createDefaultEntryKindPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultDirectoryRemovalPort } from "../infrastructure/node/file-system/directory-removal-port.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { createDefaultExceptionRepositoryOf } from "../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { createDefaultFileCreationPort } from "../infrastructure/node/file-system/file-creation-port.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../infrastructure/git/git-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { createRecordsFolder } from "../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";
import { createSymptomCatalogueRepository } from "../infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import { exceptionEntryParser } from "../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { foundTreeRecordsSourceOf } from "../infrastructure/discipline-exceptions-folder/found-tree-records-source.ts";
import { loadFailureDetail } from "../infrastructure/printed-report/load-failures/load-failure-text.ts";
import { recordsEditor } from "../infrastructure/hone-records-folder/writing/records-edit.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { shownPathOfRepository } from "../infrastructure/command-line/installation/shown-path.ts";
import { versionOneAwareRecordsSourceOf } from "../infrastructure/discipline-exceptions-folder/base-standing-records-source.ts";
import { AUTHORISE, PROJECT, PRUNE_DEBT, RECORD_DEBT, SPLIT_RECORDS, VERSION_TWO_NEEDED, VERSION_TWO_PROJECT, VERSION_TWO_PRUNE_DEBT, VERSION_TWO_RECORD_DEBT } from "./commands.ts";
import { GUIDED_CHECK, VERSION_TWO_CHECK } from "./check-command.ts";
import { type CommandHandler, commandOf, type Subcommands, toolCommandOf } from "./composed-command.ts";
import type { ToolPorts } from "./tool-ports.ts";
import { alreadyUpgradedCommand, UPGRADE } from "./upgrade-command.ts";
import { notReadyCommandOf, settingsRequiringCommandOf, versionChosenCommandOf } from "./version-chosen-command.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

export const INSTALLED_PORTS: ToolPorts = {
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  engine: createDefaultEnginePort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  exceptionEntryParser,
  selectionRepositoryOf: createSelectionRepository,
  shownPathOfRepository,
  gitTree: createDefaultGitTreePort({}),
  directory: createDefaultDirectoryPort({}),
  stagesOver: versionTwoStagesOver,
  recordsSourceOf: versionOneAwareRecordsSourceOf({
    recordsSourceOf: createRecordsFolder,
    exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  }),
  removal: createDefaultFileRemovalPort({}),
  recordsReader,
  recordsEditor,
  fileCreation: createDefaultFileCreationPort({}),
  fileRemoval: createDefaultFileRemovalPort({}),
  directoryRemoval: createDefaultDirectoryRemovalPort({}),
  entryKind: createDefaultEntryKindPort({}),
  foundTreeRecordsSourceOf,
  loadFailureDetail,
  symptomCatalogueOf: createSymptomCatalogueRepository,
  settingsFormat: SETTINGS_FILE_FORMAT,
  settingsSourcesOf: createSettingsSources,
};

export const toolSubcommandsOf = (ports: ToolPorts): Subcommands => ({
  check: versionChosenCommandOf({ ports, versionOne: commandOf({ tool: GUIDED_CHECK, ports }), versionTwo: commandOf({ tool: VERSION_TWO_CHECK, ports }) }),
  project: versionChosenCommandOf({ ports, versionOne: commandOf({ tool: PROJECT, ports }), versionTwo: commandOf({ tool: VERSION_TWO_PROJECT, ports }) }),
  "record-debt": versionChosenCommandOf({ ports, versionOne: commandOf({ tool: RECORD_DEBT, ports }), versionTwo: commandOf({ tool: VERSION_TWO_RECORD_DEBT, ports }) }),
  "prune-debt": versionChosenCommandOf({ ports, versionOne: commandOf({ tool: PRUNE_DEBT, ports }), versionTwo: commandOf({ tool: VERSION_TWO_PRUNE_DEBT, ports }) }),
  authorise: settingsRequiringCommandOf({ ports, versionOne: commandOf({ tool: VERSION_TWO_NEEDED, ports }), versionTwo: commandOf({ tool: AUTHORISE, ports }) }),
  "split-records": settingsRequiringCommandOf({ ports, versionOne: commandOf({ tool: SPLIT_RECORDS, ports }), versionTwo: notReadyCommandOf({ ports, command: "split-records" }) }),
  upgrade: settingsRequiringCommandOf({ ports, versionOne: commandOf({ tool: UPGRADE, ports }), versionTwo: alreadyUpgradedCommand }),
});

export const toolCommandOver = (ports: ToolPorts): CommandHandler => toolCommandOf({ subcommands: toolSubcommandsOf(ports), ports });

export const runToolCommand: CommandHandler = toolCommandOver(INSTALLED_PORTS);
