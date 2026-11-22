import type {
  CheckArguments,
  CheckLocations,
} from "../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { VersionOneCommandPorts } from "../application/ports/version-one-command-request.ts";
import type { VersionTwoRun } from "../application/run/version-two-run.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import { runVerdictOf } from "../domain/report/report-sections.ts";
import type { RunReport } from "../domain/report/run-report.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { Result } from "../domain/result.ts";
import {
  REPORT_OUTPUTS,
  type ReportOutput,
  VERSION_TWO_REPORT_OUTPUTS,
  type VersionTwoReportOutput,
} from "../domain/settings/report-output.ts";
import { parseCheckArguments } from "../infrastructure/command-line/arguments/command-arguments.ts";
import {
  projectCommandOf,
  pruneCommandOf,
} from "../infrastructure/command-line/arguments/tool-invocations.ts";
import { packageLinkOf } from "../infrastructure/command-line/installation/package-link.ts";
import { shownPathOf } from "../infrastructure/command-line/installation/shown-path.ts";
import {
  type CheckRun,
  checkCommandOutcome,
  type GuidedCheckRun,
  guidedCheckCommandOutcome,
} from "../infrastructure/command-line/outcomes/check-command-outcome.ts";
import type { CommandOutcome } from "../infrastructure/command-line/outcomes/command-outcome.ts";
import { checkLocationsOf } from "../infrastructure/printed-report/check-locations.ts";
import { renderRunReportText } from "../infrastructure/printed-report/run-report-text.ts";
import {
  type SymptomGuideIn,
  symptomGuideIn,
} from "../infrastructure/printed-report/symptoms/symptom-guide.ts";
import { checkOf } from "../operations/check/run-check-command.ts";
import { versionTwoCheckOf } from "../operations/check/version-two-check-command.ts";
import { loadFailed, loadResultOf, runFailed, type ToolCommand } from "./composed-command.ts";
import type { ToolPorts, VersionOneToolPorts } from "./tool-ports.ts";
import { runSettingsOver, withShownPaths } from "./version-one-runs.ts";
import {
  repositoryLocatedOf,
  stagesOverRepository,
  type VersionTwoRepositoryPorts,
} from "./version-two-repository.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

type CheckCommands = { readonly projectCommand: string; readonly pruneCommand: string };

type VersionTwoCheckRun = {
  readonly located: RepositoryLocated;
  readonly commands: CheckCommands;
  readonly run: VersionTwoRun;
};

export type CheckRunAt = (
  request: VersionOneCommandPorts & { readonly locations: CheckLocations },
) => Promise<Result<CheckRun, LoadFailure>>;

export type GuidedCheckRequest = {
  readonly ports: VersionOneCommandPorts;
  readonly arguments: CheckArguments<ReportOutput>;
  readonly checkRunAt: CheckRunAt;
  readonly symptomGuideIn: SymptomGuideIn;
};

export type VersionTwoChecked = { readonly outcome: CommandOutcome; readonly report: RunReport };

const checkCommandsOf = (request: {
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

const unshownCheckRunAt = async (
  request: VersionOneCommandPorts & CheckLocations,
): Promise<Result<CheckRun, LoadFailure>> => {
  const commands = checkCommandsOf(request);
  if (commands.outcome === "failed") {
    return commands;
  }
  const checked = await checkOf({ ...request, runSettingsOf: runSettingsOver(request) });
  return checked.outcome === "failed"
    ? checked
    : { outcome: "ok", value: { ...checked.value, ...commands.value } };
};

export const checkRunAt: CheckRunAt = async (request) => {
  const { path, fileText } = request;
  const { repoRoot, installRoot } = request.locations;
  const run = await unshownCheckRunAt({ ...request, ...request.locations });
  return withShownPaths({
    path,
    fileText,
    repoRoot,
    installRoot: { outcome: "ok", value: installRoot },
    run,
  });
};

const parseVersionOneCheck = (request: {
  readonly arguments: readonly string[];
}): Result<CheckArguments<ReportOutput>, LoadFailure> =>
  parseCheckArguments({ arguments: request.arguments, reportOutputs: REPORT_OUTPUTS });

export const CHECK: ToolCommand<CheckArguments<ReportOutput>, CheckRun, VersionOneToolPorts> = {
  parse: parseVersionOneCheck,
  run: async ({ command, ports, parsed }) => {
    const locations = checkLocationsOf({
      arguments: parsed,
      path: ports.path,
      fileText: ports.fileText,
      moduleUrl: command.moduleUrl,
    });
    return locations.outcome === "failed"
      ? loadFailed({ failure: locations.error })
      : loadResultOf({
          result: await checkRunAt({
            ...ports,
            moduleUrl: command.moduleUrl,
            locations: locations.value,
          }),
        });
  },
  print: ({ produced }) => checkCommandOutcome({ result: { outcome: "ok", value: produced } }),
};

export const guidedCheckRunFor = async (
  request: GuidedCheckRequest,
): Promise<Result<GuidedCheckRun, LoadFailure>> => {
  const { ports } = request;
  const { path, fileText, moduleUrl } = ports;
  const locations = checkLocationsOf({ arguments: request.arguments, path, fileText, moduleUrl });
  if (locations.outcome === "failed") {
    return locations;
  }
  const run = await request.checkRunAt({ ...ports, locations: locations.value });
  if (run.outcome === "failed") {
    return run;
  }
  const guide = request.symptomGuideIn({
    path,
    fileText,
    repoRoot: locations.value.repoRoot,
    installRoot: locations.value.installRoot,
  });
  return { outcome: "ok", value: { ...run.value, guide } };
};

export const GUIDED_CHECK: ToolCommand<
  CheckArguments<ReportOutput>,
  GuidedCheckRun,
  VersionOneToolPorts & Pick<ToolPorts, "boundCatalogueOf">
> = {
  parse: parseVersionOneCheck,
  run: async ({ command, ports, parsed }) =>
    loadResultOf({
      result: await guidedCheckRunFor({
        ports: { ...ports, moduleUrl: command.moduleUrl },
        arguments: parsed,
        checkRunAt,
        symptomGuideIn: (locations) =>
          symptomGuideIn({ ...locations, boundCatalogueOf: ports.boundCatalogueOf }),
      }),
    }),
  print: ({ produced }) =>
    guidedCheckCommandOutcome({ result: { outcome: "ok", value: produced } }),
};

const symptomPageOf = (request: {
  readonly ports: Pick<ToolPorts, "path" | "fileText">;
  readonly located: RepositoryLocated;
}): string => {
  const { path, fileText } = request.ports;
  const { repoRoot, installRoot } = request.located;
  return shownPathOf({
    path,
    repoRoot,
    link: packageLinkOf({ path, fileText, repoRoot, installRoot }),
    target: path.join({ segments: [installRoot, ...SYMPTOM_PAGE_SEGMENTS] }),
  });
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
  print: ({ ports, produced }) => {
    const { report, catalogue, output } = produced.run;
    return {
      code: runVerdictOf({ report }) === "pass" ? 0 : 1,
      text: renderRunReportText({
        report,
        catalogue,
        output,
        symptomPage: symptomPageOf({ ports, located: produced.located }),
        ...produced.commands,
      }),
    };
  },
};
