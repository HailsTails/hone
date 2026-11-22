import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
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

type NoSettingsHandler = (request: {
  readonly command: ToolInvocation;
  readonly repoRoot: AbsolutePath;
}) => Promise<void>;

const chosenCommandOf =
  (request: VersionChoice & { readonly noSettings: NoSettingsHandler }): CommandHandler =>
  (command) => {
    const located = commandRunPathOf({
      command: {
        process: command.process,
        path: request.ports.path,
        fileText: request.ports.fileText,
      },
    });
    if (located.kind === "no-repository") {
      return request.versionOne(command);
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
        return request.versionOne(command);
      case "version-2":
        return request.versionTwo(command);
      case "no-settings":
        return request.noSettings({ command, repoRoot: located.repoRoot });
    }
  };

export const versionChosenCommandOf = (request: VersionChoice): CommandHandler =>
  chosenCommandOf({ ...request, noSettings: ({ command }) => request.versionTwo(command) });

export const settingsRequiringCommandOf = (request: VersionChoice): CommandHandler =>
  chosenCommandOf({
    ...request,
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
