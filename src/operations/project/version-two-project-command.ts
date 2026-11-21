import { parseProjectArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome, projectCommandOutcome } from "../../infrastructure/command-line/outcomes/command-outcome.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { VersionedHandler } from "../../infrastructure/command-line/run-path/version-chosen-command.ts";
import { projectedFilesWrittenOf } from "../../application/projection/projected-files-written.ts";
import { runLoadFailureOutcomeOf, upgradeCommandFor } from "../../infrastructure/command-line/run-path/run-load-failure-outcome.ts";
import { repositoryLocatedOf, stagesOverRepository, type VersionTwoRepositoryPorts } from "../../version-two-repository.ts";
import { versionTwoProjectionOver } from "../../application/projection/version-two-projection.ts";

type ProjectCommand = Parameters<VersionedHandler>[0];

const outcomeOf = async (request: { readonly ports: VersionTwoRepositoryPorts; readonly command: ProjectCommand }): Promise<CommandOutcome> => {
  const { command, ports } = request;
  const parsed = parseProjectArguments({ arguments: command.process.arguments });
  if (parsed.outcome === "failed") {
    return loadFailureOutcome({ failure: parsed.error });
  }
  const located = repositoryLocatedOf({ command, repo: parsed.value.repo });
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const upgradeCommand = upgradeCommandFor({ path: command.path, moduleUrl: command.moduleUrl, repoRoot: located.value.repoRoot });
  const projected = await versionTwoProjectionOver({ stages: stagesOverRepository({ ports, command, located: located.value, baseRevision: undefined }) });
  if (projected.outcome === "failed") {
    return runLoadFailureOutcomeOf({ failure: projected.error, upgradeCommand });
  }
  const written = projectedFilesWrittenOf({ fileText: command.fileText, path: command.path, repoRoot: located.value.repoRoot, files: projected.value });
  return written.outcome === "failed" ? runLoadFailureOutcomeOf({ failure: written.error, upgradeCommand }) : projectCommandOutcome({ result: written });
};

export const versionTwoProjectCommandOf =
  (ports: VersionTwoRepositoryPorts): VersionedHandler =>
  async (command) => {
    printOutcome({ process: command.process, outcome: await outcomeOf({ ports, command }) });
  };
