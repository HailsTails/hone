import type { CheckArguments } from "../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { VersionTwoRun } from "../application/run/version-two-run.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import { runVerdictOf } from "../domain/report/report-sections.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import {
  VERSION_TWO_REPORT_OUTPUTS,
  type VersionTwoReportOutput,
} from "../domain/settings/report-output.ts";
import { parseCheckArguments } from "../infrastructure/command-line/arguments/command-arguments.ts";
import {
  projectCommandOf,
  pruneCommandOf,
} from "../infrastructure/command-line/arguments/tool-invocations.ts";
import { shownPathOfRepository } from "../infrastructure/command-line/installation/shown-path.ts";
import {
  type RunReportRequest,
  renderRunReportText,
} from "../infrastructure/printed-report/run-report-text.ts";
import { versionTwoCheckOf } from "../operations/check/version-two-check-command.ts";
import { loadFailed, runFailed, type ToolCommand } from "./composed-command.ts";
import type { ToolPorts } from "./tool-ports.ts";
import {
  repositoryLocatedOf,
  stagesOverRepository,
  type VersionTwoRepositoryPorts,
} from "./version-two-repository.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

type CheckCommands = { readonly projectCommand: string; readonly pruneCommand: string };

export type VersionTwoCheckRun = {
  readonly located: RepositoryLocated;
  readonly commands: CheckCommands;
  readonly run: VersionTwoRun;
};

export const checkCommandsOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
  readonly repoRoot: AbsolutePath;
  readonly arguments: Pick<CheckArguments<string>, "baseRevision" | "forfeiture">;
}): Result<CheckCommands, LoadFailure> => {
  const { path, moduleUrl, repoRoot } = request;
  const projectCommand = projectCommandOf({ path, moduleUrl, repoRoot });
  if (projectCommand.outcome === "failed") {
    return projectCommand;
  }
  const pruneCommand = pruneCommandOf({
    path,
    moduleUrl,
    repoRoot,
    baseRevision: request.arguments.baseRevision,
    forfeiture: request.arguments.forfeiture,
  });
  return pruneCommand.outcome === "failed"
    ? pruneCommand
    : {
        outcome: "ok",
        value: { projectCommand: projectCommand.value, pruneCommand: pruneCommand.value },
      };
};

export const reportPagesOf = (request: {
  readonly ports: Pick<ToolPorts, "path" | "fileText">;
  readonly located: RepositoryLocated;
}) => {
  const { path } = request.ports;
  return {
    symptomPage: path.join({ segments: [request.located.installRoot, ...SYMPTOM_PAGE_SEGMENTS] }),
    showPage: shownPathOfRepository({ ...request.ports, ...request.located }),
  };
};

export const versionTwoReportRequestOf = (request: {
  readonly ports: Pick<ToolPorts, "path" | "fileText">;
  readonly produced: VersionTwoCheckRun;
}): RunReportRequest => {
  const { report, catalogue, content, output } = request.produced.run;
  return {
    report,
    catalogue,
    content,
    output,
    ...reportPagesOf({ ports: request.ports, located: request.produced.located }),
    ...request.produced.commands,
  };
};

export const VERSION_TWO_CHECK: ToolCommand<
  CheckArguments<VersionTwoReportOutput>,
  VersionTwoCheckRun,
  VersionTwoRepositoryPorts
> = {
  parse: ({ arguments: given }) =>
    parseCheckArguments({ arguments: given, reportOutputs: VERSION_TWO_REPORT_OUTPUTS }),
  run: async ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
    });
    if (located.outcome === "failed") {
      return loadFailed({ failure: located.error });
    }
    const commands = checkCommandsOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repoRoot: located.value.repoRoot,
      arguments: parsed,
    });
    if (commands.outcome === "failed") {
      return loadFailed({ failure: commands.error });
    }
    const run = await versionTwoCheckOf({
      stages: stagesOverRepository({
        ports,
        moduleUrl: command.moduleUrl,
        located: located.value,
        baseRevision: parsed.baseRevision,
      }),
      arguments: parsed,
    });
    return run.outcome === "failed"
      ? runFailed({ failure: run.error, repoRoot: located.value.repoRoot })
      : {
          outcome: "ok",
          value: { located: located.value, commands: commands.value, run: run.value },
        };
  },
  print: ({ ports, produced }) => ({
    code: runVerdictOf({ report: produced.run.report }) === "pass" ? 0 : 1,
    text: renderRunReportText(versionTwoReportRequestOf({ ports, produced })),
  }),
};
