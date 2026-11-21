import { type AuthoriseArguments, parseAuthoriseArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { loadFailureOutcome } from "../../infrastructure/command-line/outcomes/command-outcome.ts";
import type { CommandRequest } from "../../application/ports/command-request.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { FilePresence } from "../../infrastructure/node/file-system/file-text-port.ts";
import { VERSION_ONE_SETTINGS_FILE_NAME } from "../../infrastructure/hone-config-file/settings-sources.ts";
import { printFailure, type VersionedHandler } from "../../infrastructure/command-line/run-path/version-chosen-command.ts";
import { repoRootOf } from "../../version-two-repository.ts";

const versionOneFilePresence = (request: { readonly command: CommandRequest; readonly repoRoot: string }): FilePresence =>
  request.command.fileText.exists({ path: request.command.path.join({ segments: [request.repoRoot, VERSION_ONE_SETTINGS_FILE_NAME] }) });

const parsedOf = (request: { readonly command: CommandRequest }) => parseAuthoriseArguments({ arguments: request.command.process.arguments });

const needsOf = (request: { readonly command: CommandRequest; readonly parsed: AuthoriseArguments }): Promise<void> => {
  const repoRoot = repoRootOf({ command: request.command, repo: request.parsed.repo });
  if (repoRoot.outcome === "failed") {
    printOutcome({ process: request.command.process, outcome: loadFailureOutcome({ failure: repoRoot.error }) });
    return Promise.resolve();
  }
  return printFailure({
    command: request.command,
    failure: versionOneFilePresence({ command: request.command, repoRoot: repoRoot.value }) === "present"
      ? { kind: "upgrade-needed", path: VERSION_ONE_SETTINGS_FILE_NAME }
      : { kind: "config-absent", repo: repoRoot.value },
    repoRoot: repoRoot.value,
  });
};

export const versionTwoNeededCommandOf: VersionedHandler = (command) => {
  const parsed = parsedOf({ command });
  if (parsed.outcome === "failed") {
    printOutcome({ process: command.process, outcome: loadFailureOutcome({ failure: parsed.error }) });
    return Promise.resolve();
  }
  return needsOf({ command, parsed: parsed.value });
};
