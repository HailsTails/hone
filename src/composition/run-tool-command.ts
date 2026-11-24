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
import { VERSION_TWO_CHECK } from "./check-command.ts";
import {
  AUTHORISE,
  SPLIT_RECORDS,
  VERSION_TWO_NEEDED,
  VERSION_TWO_PROJECT,
  VERSION_TWO_PRUNE_DEBT,
  VERSION_TWO_RECORD_DEBT,
  CURRENT_NAMES_UPGRADE,
} from "./commands.ts";
import {
  type CommandHandler,
  commandOf,
  type Subcommands,
  toolCommandOf,
} from "./composed-command.ts";
import { installedPortsOver } from "./installed-ports.ts";
import type { ToolPorts } from "./tool-ports.ts";
import { UPGRADE } from "./upgrade-command.ts";
import {
  notReadyCommandOf,
  settingsRequiringCommandOf,
  namedSettingsCommandOf,
} from "./version-chosen-command.ts";

export const INSTALLED_PORTS: ToolPorts = installedPortsOver({
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort(),
  gitTree: createDefaultGitTreePort(),
  directory: createDefaultDirectoryPort({}),
  fileCreation: createDefaultFileCreationPort({}),
  fileRemoval: createDefaultFileRemovalPort({}),
  directoryRemoval: createDefaultDirectoryRemovalPort({}),
  entryKind: createDefaultEntryKindPort({}),
});

export const toolSubcommandsOf = (ports: ToolPorts): Subcommands => ({
  check: namedSettingsCommandOf({ ports, run: commandOf({ tool: VERSION_TWO_CHECK, ports }) }),
  project: namedSettingsCommandOf({ ports, run: commandOf({ tool: VERSION_TWO_PROJECT, ports }) }),
  "record-debt": namedSettingsCommandOf({
    ports,
    run: commandOf({ tool: VERSION_TWO_RECORD_DEBT, ports }),
  }),
  "prune-debt": namedSettingsCommandOf({
    ports,
    run: commandOf({ tool: VERSION_TWO_PRUNE_DEBT, ports }),
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
    versionTwo: commandOf({ tool: CURRENT_NAMES_UPGRADE, ports }),
  }),
});

export const toolCommandOver = (ports: ToolPorts): CommandHandler =>
  toolCommandOf({ subcommands: toolSubcommandsOf(ports), ports });

export const runToolCommand: CommandHandler = toolCommandOver(INSTALLED_PORTS);
