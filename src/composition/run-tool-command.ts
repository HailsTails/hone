import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../infrastructure/git/git-port.ts";
import { createDefaultDirectoryRemovalPort } from "../infrastructure/node/file-system/directory-removal-port.ts";
import { createDefaultFileCreationPort } from "../infrastructure/node/file-system/file-creation-port.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import {
  createDefaultDirectoryPort,
  createDefaultEntryKindPort,
} from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { GUIDED_CHECK, VERSION_TWO_CHECK } from "./check-command.ts";
import {
  AUTHORISE,
  PROJECT,
  PRUNE_DEBT,
  RECORD_DEBT,
  SPLIT_RECORDS,
  VERSION_TWO_NEEDED,
  VERSION_TWO_PROJECT,
  VERSION_TWO_PRUNE_DEBT,
  VERSION_TWO_RECORD_DEBT,
} from "./commands.ts";
import {
  type CommandHandler,
  commandOf,
  type Subcommands,
  toolCommandOf,
} from "./composed-command.ts";
import { installedPortsOver } from "./installed-ports.ts";
import type { ToolPorts } from "./tool-ports.ts";
import { alreadyUpgradedCommand, UPGRADE } from "./upgrade-command.ts";
import {
  notReadyCommandOf,
  settingsRequiringCommandOf,
  versionChosenCommandOf,
} from "./version-chosen-command.ts";

export const INSTALLED_PORTS: ToolPorts = installedPortsOver({
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  engine: createDefaultEnginePort({}),
  git: createDefaultGitPort({}),
  gitTree: createDefaultGitTreePort({}),
  directory: createDefaultDirectoryPort({}),
  fileCreation: createDefaultFileCreationPort({}),
  fileRemoval: createDefaultFileRemovalPort({}),
  directoryRemoval: createDefaultDirectoryRemovalPort({}),
  entryKind: createDefaultEntryKindPort({}),
});

export const toolSubcommandsOf = (ports: ToolPorts): Subcommands => ({
  check: versionChosenCommandOf({
    ports,
    versionOne: commandOf({ tool: GUIDED_CHECK, ports }),
    versionTwo: commandOf({ tool: VERSION_TWO_CHECK, ports }),
  }),
  project: versionChosenCommandOf({
    ports,
    versionOne: commandOf({ tool: PROJECT, ports }),
    versionTwo: commandOf({ tool: VERSION_TWO_PROJECT, ports }),
  }),
  "record-debt": versionChosenCommandOf({
    ports,
    versionOne: commandOf({ tool: RECORD_DEBT, ports }),
    versionTwo: commandOf({ tool: VERSION_TWO_RECORD_DEBT, ports }),
  }),
  "prune-debt": versionChosenCommandOf({
    ports,
    versionOne: commandOf({ tool: PRUNE_DEBT, ports }),
    versionTwo: commandOf({ tool: VERSION_TWO_PRUNE_DEBT, ports }),
  }),
  authorise: settingsRequiringCommandOf({
    ports,
    versionOne: commandOf({ tool: VERSION_TWO_NEEDED, ports }),
    versionTwo: commandOf({ tool: AUTHORISE, ports }),
  }),
  "split-records": settingsRequiringCommandOf({
    ports,
    versionOne: commandOf({ tool: SPLIT_RECORDS, ports }),
    versionTwo: notReadyCommandOf({ ports, command: "split-records" }),
  }),
  upgrade: settingsRequiringCommandOf({
    ports,
    versionOne: commandOf({ tool: UPGRADE, ports }),
    versionTwo: alreadyUpgradedCommand,
  }),
});

export const toolCommandOver = (ports: ToolPorts): CommandHandler =>
  toolCommandOf({ subcommands: toolSubcommandsOf(ports), ports });

export const runToolCommand: CommandHandler = toolCommandOver(INSTALLED_PORTS);
