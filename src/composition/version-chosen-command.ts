import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { VERSION_ONE_SETTINGS_FILE_NAME } from "../domain/settings/settings-file.ts";
import type { Subcommand } from "../infrastructure/command-line/arguments/command-line.ts";
import { printOutcome } from "../infrastructure/command-line/outcomes/print-outcome.ts";
import { commandRunPathOf } from "../infrastructure/command-line/run-path/command-run-path.ts";
import { type CommandHandler, failureOutcomeOf } from "./composed-command.ts";
import type { ToolInvocation, ToolPorts } from "./tool-ports.ts";

type RunPathPorts = Pick<ToolPorts, "path" | "fileText">;

export type VersionChoice = {
  readonly ports: RunPathPorts;
  readonly versionOne: CommandHandler;
  readonly versionTwo: CommandHandler;
};

const printedFailure = (request: {
  readonly ports: RunPathPorts;
  readonly command: ToolInvocation;
  readonly failure: RunLoadFailure;
  readonly repoRoot: AbsolutePath | undefined;
}): Promise<void> => {
  const { command, failure, repoRoot } = request;
  printOutcome({
    process: command.process,
    outcome: failureOutcomeOf({
      command,
      path: request.ports.path,
      failure: { failed: "run", failure, repoRoot },
    }),
  });
  return Promise.resolve();
};

type LocatedSettingsHandler = (request: {
  readonly command: ToolInvocation;
  readonly repoRoot: AbsolutePath;
}) => Promise<void>;

const chosenCommandOf =
  (
    request: Pick<VersionChoice, "ports" | "versionTwo"> & {
      readonly unlocated: CommandHandler;
      readonly versionOne: LocatedSettingsHandler;
      readonly noSettings: LocatedSettingsHandler;
    },
  ): CommandHandler =>
  (command) => {
    const located = commandRunPathOf({
      command: {
        process: command.process,
        path: request.ports.path,
        fileText: request.ports.fileText,
      },
    });
    if (located.kind === "no-repository") {
      return request.unlocated(command);
    }
    if (located.chosen.outcome === "failed") {
      return printedFailure({
        ports: request.ports,
        command,
        failure: located.chosen.error,
        repoRoot: located.repoRoot,
      });
    }
    switch (located.chosen.value) {
      case "version-1":
        return request.versionOne({ command, repoRoot: located.repoRoot });
      case "version-2":
        return request.versionTwo(command);
      case "no-settings":
        return request.noSettings({ command, repoRoot: located.repoRoot });
    }
  };

export const namedSettingsCommandOf = (request: {
  readonly ports: RunPathPorts;
  readonly run: CommandHandler;
}): CommandHandler =>
  chosenCommandOf({
    ports: request.ports,
    unlocated: request.run,
    versionTwo: request.run,
    noSettings: ({ command }) => request.run(command),
    versionOne: ({ command, repoRoot }) =>
      printedFailure({
        ports: request.ports,
        command,
        failure: { kind: "upgrade-needed", path: VERSION_ONE_SETTINGS_FILE_NAME },
        repoRoot,
      }),
  });

export const settingsRequiringCommandOf = (request: VersionChoice): CommandHandler =>
  chosenCommandOf({
    ports: request.ports,
    unlocated: request.versionOne,
    versionOne: ({ command }) => request.versionOne(command),
    versionTwo: request.versionTwo,
    noSettings: ({ command, repoRoot }) =>
      printedFailure({
        ports: request.ports,
        command,
        failure: { kind: "config-absent", repo: repoRoot },
        repoRoot,
      }),
  });

export const notReadyCommandOf =
  (request: { readonly ports: RunPathPorts; readonly command: Subcommand }): CommandHandler =>
  (command) =>
    printedFailure({
      ports: request.ports,
      command,
      failure: { kind: "not-ready-yet", what: { thing: "command", command: request.command } },
      repoRoot: undefined,
    });
