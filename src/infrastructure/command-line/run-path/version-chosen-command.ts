import type { Subcommand } from "../arguments/command-line.ts";
import type { CommandRequest } from "../../../application/ports/command-request.ts";
import { printOutcome } from "../outcomes/print-outcome.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../content-files/absolute-path.ts";
import { commandRunPathOf } from "./command-run-path.ts";
import { runLoadFailureOutcomeOf, upgradeCommandFor } from "./run-load-failure-outcome.ts";

export type VersionedHandler<Request extends CommandRequest = CommandRequest> = (command: Request) => Promise<void>;

export type VersionChoice<Request extends CommandRequest> = {
  readonly versionOne: VersionedHandler<Request>;
  readonly versionTwo: VersionedHandler;
};

export const printFailure = (request: {
  readonly command: CommandRequest;
  readonly failure: RunLoadFailure;
  readonly repoRoot: AbsolutePath | undefined;
}): Promise<void> => {
  const upgradeCommand =
    request.repoRoot === undefined ? undefined : upgradeCommandFor({ path: request.command.path, moduleUrl: request.command.moduleUrl, repoRoot: request.repoRoot });
  printOutcome({ process: request.command.process, outcome: runLoadFailureOutcomeOf({ failure: request.failure, upgradeCommand }) });
  return Promise.resolve();
};

type NoSettingsHandler<Request extends CommandRequest> = (request: { readonly command: Request; readonly repoRoot: AbsolutePath }) => Promise<void>;

const chosenCommandOf =
  <Request extends CommandRequest>(request: VersionChoice<Request> & { readonly noSettings: NoSettingsHandler<Request> }): VersionedHandler<Request> =>
  (command) => {
    const located = commandRunPathOf({ command });
    if (located.kind === "no-repository") {
      return request.versionOne(command);
    }
    if (located.chosen.outcome === "failed") {
      return printFailure({ command, failure: located.chosen.error, repoRoot: located.repoRoot });
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

export const versionChosenCommandOf = <Request extends CommandRequest>(request: VersionChoice<Request>): VersionedHandler<Request> =>
  chosenCommandOf({ ...request, noSettings: ({ command }) => request.versionTwo(command) });

export const settingsRequiringCommandOf = <Request extends CommandRequest>(request: VersionChoice<Request>): VersionedHandler<Request> =>
  chosenCommandOf({
    ...request,
    noSettings: ({ command, repoRoot }) => printFailure({ command, failure: { kind: "config-absent", repo: repoRoot }, repoRoot }),
  });

export const notReadyCommandOf =
  (request: { readonly command: Subcommand }): VersionedHandler =>
  (command) =>
    printFailure({ command, failure: { kind: "not-ready-yet", what: { thing: "command", command: request.command } }, repoRoot: undefined });
