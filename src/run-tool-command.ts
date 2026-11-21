import { createDefaultExceptionRepositoryOf } from "./infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { createDefaultDirectoryRemovalPort } from "./infrastructure/node/file-system/directory-removal-port.ts";
import { createDefaultFileCreationPort } from "./infrastructure/node/file-system/file-creation-port.ts";
import { createDefaultDirectoryPort, createDefaultEntryKindPort } from "./infrastructure/node/file-system/file-system-port.ts";
import { alreadyUpgradedCommand, upgradeCommandOf } from "./operations/upgrade/run-upgrade-command.ts";
import { createRecordsFolder } from "./infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { createDefaultFileRemovalPort } from "./infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultGitTreePort } from "./infrastructure/git/git-port.ts";
import { notReadyCommandOf, settingsRequiringCommandOf, versionChosenCommandOf } from "./infrastructure/command-line/run-path/version-chosen-command.ts";
import { versionTwoCheckCommandOf, versionTwoCheckedOf } from "./operations/check/version-two-check-command.ts";
import { versionTwoProjectCommandOf } from "./operations/project/version-two-project-command.ts";
import { versionTwoNeededCommandOf } from "./operations/authorise/version-two-needed-command.ts";
import { versionTwoAuthoriseCommandOf, versionTwoPruneDebtCommandOf, versionTwoRecordDebtCommandOf } from "./operations/version-two-record-commands.ts";
import { installedStagesOver } from "./version-two-repository.ts";
import { versionOneAwareRecordsSourceOf } from "./infrastructure/discipline-exceptions-folder/base-standing-records-source.ts";
import { foundTreeRecordsSourceOf } from "./infrastructure/discipline-exceptions-folder/found-tree-records-source.ts";
import { recordsReader } from "./infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "./infrastructure/hone-records-folder/writing/records-edit.ts";
import { loadFailureDetail } from "./infrastructure/printed-report/load-failures/load-failure-text.ts";
import { createSymptomCatalogueRepository } from "./infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import { SETTINGS_FILE_FORMAT } from "./infrastructure/hone-config-file/settings-file.ts";
import { createSettingsSources } from "./infrastructure/hone-config-file/settings-sources.ts";
import { parseInvocation } from "./infrastructure/command-line/arguments/command-arguments.ts";
import { helpText } from "./infrastructure/command-line/arguments/command-help.ts";
import type { HelpTopic, Subcommand } from "./infrastructure/command-line/arguments/command-line.ts";
import { RUN_SUBCOMMANDS, runHelpText } from "./operations/help/run-help.ts";
import type { CommandRequest } from "./application/ports/command-request.ts";
import { commandRunPathOf } from "./infrastructure/command-line/run-path/command-run-path.ts";
import { loadFailureOutcome, versionCommandOutcome } from "./infrastructure/command-line/outcomes/command-outcome.ts";
import { installedVersionOf } from "./infrastructure/command-line/installation/installed-version.ts";
import { printOutcome } from "./infrastructure/command-line/outcomes/print-outcome.ts";
import type { VersionOneCommandRequest } from "./application/ports/version-one-command-request.ts";
import { runGuidedCheckCommand } from "./operations/check/run-guided-check-command.ts";
import { runProjectCommand } from "./operations/project/run-project-command.ts";
import { runPruneDebtCommand } from "./operations/prune-debt/run-prune-debt-command.ts";
import { recordDebtCommandOf } from "./operations/record-debt/run-record-debt-command.ts";
import { runSplitRecordsCommand } from "./operations/split-records/run-split-records-command.ts";

export type CommandHandler = (request: VersionOneCommandRequest) => Promise<void>;

export type Subcommands = Readonly<Record<Subcommand, CommandHandler>>;

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

type HelpEdition = "version-1" | "version-2";

const helpEditionOf = (request: { readonly command: CommandRequest }): HelpEdition => {
  const located = commandRunPathOf({ command: request.command });
  return located.kind === "repository" && located.chosen.outcome === "ok" && located.chosen.value === "version-1" ? "version-1" : "version-2";
};

const helpOf = (request: { readonly command: CommandRequest; readonly topic: HelpTopic }): string => {
  const runTopic = request.topic === "tool" ? request.topic : RUN_SUBCOMMANDS.find((subcommand) => subcommand === request.topic);
  return runTopic === undefined || helpEditionOf({ command: request.command }) === "version-1"
    ? helpText({ topic: request.topic })
    : runHelpText({ topic: runTopic });
};

const dispatched = (request: { readonly subcommands: Subcommands; readonly command: VersionOneCommandRequest }): Promise<void> => {
  const { command } = request;
  const invocation = parseInvocation({ arguments: command.process.arguments });
  if (invocation.outcome === "failed") {
    printOutcome({ process: command.process, outcome: loadFailureOutcome({ failure: invocation.error }) });
    return Promise.resolve();
  }
  switch (invocation.value.kind) {
    case "help":
      printOutcome({ process: command.process, outcome: { code: 0, text: helpOf({ command, topic: invocation.value.topic }) } });
      return Promise.resolve();
    case "version":
      printOutcome({ process: command.process, outcome: versionCommandOutcome({ result: installedVersionOf(command) }) });
      return Promise.resolve();
    case "run":
      return request.subcommands[invocation.value.subcommand]({
        ...command,
        process: { ...command.process, arguments: invocation.value.arguments },
      });
  }
};

export const toolCommandOf =
  (request: { readonly subcommands: Subcommands }): CommandHandler =>
  (command) =>
    Promise.resolve()
      .then(() => dispatched({ subcommands: request.subcommands, command }))
      .catch((thrown: unknown) => {
        printOutcome({
          process: command.process,
          outcome: loadFailureOutcome({ failure: { kind: "unexpected-error", detail: thrownMessage({ thrown }) } }),
        });
      });

const gitTree = createDefaultGitTreePort({});

const versionTwoPorts = {
  gitTree,
  directory: createDefaultDirectoryPort({}),
  stagesOver: installedStagesOver,
  recordsSourceOf: versionOneAwareRecordsSourceOf({
    recordsSourceOf: createRecordsFolder,
    exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  }),
};

export const installedVersionTwoCheckedOf = versionTwoCheckedOf(versionTwoPorts);

const versionTwoCheck = versionTwoCheckCommandOf(versionTwoPorts);

const versionTwoProject = versionTwoProjectCommandOf(versionTwoPorts);

const versionTwoRecordPorts = { ...versionTwoPorts, removal: createDefaultFileRemovalPort({}), recordsReader, recordsEditor };

const upgradePorts = {
  ...versionTwoPorts,
  fileCreation: createDefaultFileCreationPort({}),
  fileRemoval: createDefaultFileRemovalPort({}),
  directoryRemoval: createDefaultDirectoryRemovalPort({}),
  entryKind: createDefaultEntryKindPort({}),
  foundTreeRecordsSourceOf,
  loadFailureDetail,
  recordsReader,
  symptomCatalogueOf: createSymptomCatalogueRepository,
  settingsFormat: SETTINGS_FILE_FORMAT,
  settingsSourcesOf: createSettingsSources,
};

export const TOOL_SUBCOMMANDS: Subcommands = {
  check: versionChosenCommandOf({ versionOne: runGuidedCheckCommand, versionTwo: versionTwoCheck }),
  project: versionChosenCommandOf({ versionOne: runProjectCommand, versionTwo: versionTwoProject }),
  "record-debt": versionChosenCommandOf({ versionOne: recordDebtCommandOf({ gitTree }), versionTwo: versionTwoRecordDebtCommandOf(versionTwoRecordPorts) }),
  "prune-debt": versionChosenCommandOf({ versionOne: runPruneDebtCommand, versionTwo: versionTwoPruneDebtCommandOf(versionTwoRecordPorts) }),
  authorise: settingsRequiringCommandOf({ versionOne: versionTwoNeededCommandOf, versionTwo: versionTwoAuthoriseCommandOf(versionTwoRecordPorts) }),
  "split-records": settingsRequiringCommandOf({ versionOne: runSplitRecordsCommand, versionTwo: notReadyCommandOf({ command: "split-records" }) }),
  upgrade: settingsRequiringCommandOf({ versionOne: upgradeCommandOf(upgradePorts), versionTwo: alreadyUpgradedCommand }),
};

export const runToolCommand: CommandHandler = toolCommandOf({ subcommands: TOOL_SUBCOMMANDS });
