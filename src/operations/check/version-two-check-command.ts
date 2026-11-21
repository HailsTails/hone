import { type CheckArguments, parseCheckArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome } from "../../infrastructure/command-line/outcomes/command-outcome.ts";
import type { LoadFailure } from "../../infrastructure/command-line/load-failure.ts";
import { packageLinkOf } from "../../infrastructure/command-line/installation/package-link.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import { shownPathOf } from "../../infrastructure/command-line/installation/shown-path.ts";
import { projectCommandOf, pruneCommandOf } from "../../infrastructure/command-line/arguments/tool-invocations.ts";
import type { CommandRequest } from "../../application/ports/command-request.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import { renderRunReportText } from "../../infrastructure/printed-report/run-report-text.ts";
import { runVerdictOf } from "../../domain/report/report-sections.ts";
import { type VersionTwoReportOutput, versionTwoReportOutputSchema } from "../../infrastructure/hone-config-file/report-output.ts";
import type { AbsolutePath } from "../../infrastructure/content-files/absolute-path.ts";
import type { Result } from "../../domain/result.ts";
import { runLoadFailureOutcomeOf, upgradeCommandFor } from "../../infrastructure/command-line/run-path/run-load-failure-outcome.ts";
import { type RepositoryLocated, repositoryLocatedOf, stagesOverRepository, type VersionTwoRepositoryPorts } from "../../version-two-repository.ts";
import { type VersionTwoRun, versionTwoRunOver } from "../../application/run/version-two-run.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

type Commands = { readonly project: string; readonly prune: string };

type Located = RepositoryLocated & {
  readonly arguments: CheckArguments<VersionTwoReportOutput>;
  readonly commands: Commands;
};

const commandsOf = (request: { readonly command: CommandRequest; readonly arguments: CheckArguments<VersionTwoReportOutput>; readonly repoRoot: AbsolutePath }): Result<Commands, LoadFailure> => {
  const { path, moduleUrl } = request.command;
  const invocation = { path, moduleUrl, repoRoot: request.repoRoot };
  const project = projectCommandOf(invocation);
  if (project.outcome === "failed") {
    return project;
  }
  const prune = pruneCommandOf({ ...invocation, baseRevision: request.arguments.baseRevision, forfeiture: request.arguments.forfeiture });
  return prune.outcome === "failed" ? prune : { outcome: "ok", value: { project: project.value, prune: prune.value } };
};

const locatedOf = (request: { readonly command: CommandRequest }): Result<Located, LoadFailure> => {
  const { command } = request;
  const parsed = parseCheckArguments({ arguments: command.process.arguments, reportOutputs: versionTwoReportOutputSchema.options });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const located = repositoryLocatedOf({ command, repo: parsed.value.repo });
  if (located.outcome === "failed") {
    return located;
  }
  const commands = commandsOf({ command, arguments: parsed.value, repoRoot: located.value.repoRoot });
  return commands.outcome === "failed" ? commands : { outcome: "ok", value: { ...located.value, arguments: parsed.value, commands: commands.value } };
};

const symptomPageOf = (request: { readonly command: CommandRequest; readonly located: Located }): string => {
  const { path, fileText } = request.command;
  const { repoRoot, installRoot } = request.located;
  return shownPathOf({
    path,
    repoRoot,
    link: packageLinkOf({ path, fileText, repoRoot, installRoot }),
    target: path.join({ segments: [installRoot, ...SYMPTOM_PAGE_SEGMENTS] }),
  });
};

const runOutcomeOf = (request: { readonly command: CommandRequest; readonly located: Located; readonly run: VersionTwoRun }): CommandOutcome => {
  const { report, catalogue, output } = request.run;
  return {
    code: runVerdictOf({ report }) === "pass" ? 0 : 1,
    text: renderRunReportText({
      report,
      catalogue,
      output,
      symptomPage: symptomPageOf(request),
      projectCommand: request.located.commands.project,
      pruneCommand: request.located.commands.prune,
    }),
  };
};

export type VersionTwoChecked =
  | { readonly kind: "ran"; readonly outcome: CommandOutcome; readonly report: RunReport }
  | { readonly kind: "not-run"; readonly outcome: CommandOutcome };

const notRunWith = (request: { readonly outcome: CommandOutcome }): VersionTwoChecked => ({ kind: "not-run", outcome: request.outcome });

export const versionTwoCheckedOf =
  (ports: VersionTwoRepositoryPorts) =>
  async (command: CommandRequest): Promise<VersionTwoChecked> => {
    const located = locatedOf({ command });
    if (located.outcome === "failed") {
      return notRunWith({ outcome: loadFailureOutcome({ failure: located.error }) });
    }
    const run = await versionTwoRunOver({
      stages: stagesOverRepository({ ports, command, located: located.value, baseRevision: located.value.arguments.baseRevision }),
      arguments: { forfeiture: located.value.arguments.forfeiture, reportOutput: located.value.arguments.reportOutput, measuring: "when-debt-held" },
    });
    return run.outcome === "failed"
      ? notRunWith({
          outcome: runLoadFailureOutcomeOf({ failure: run.error, upgradeCommand: upgradeCommandFor({ path: command.path, moduleUrl: command.moduleUrl, repoRoot: located.value.repoRoot }) }),
        })
      : { kind: "ran", outcome: runOutcomeOf({ command, located: located.value, run: run.value }), report: run.value.report };
  };

export const versionTwoCheckCommandOf =
  (ports: VersionTwoRepositoryPorts) =>
  async (command: CommandRequest): Promise<void> => {
    const checked = await versionTwoCheckedOf(ports)(command);
    printOutcome({ process: command.process, outcome: checked.outcome });
  };
