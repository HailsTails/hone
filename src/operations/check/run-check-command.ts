import { createSelectionRepository, readRunSettings } from "../../infrastructure/disciplines-file/consumer-selection.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { assessmentInEffect } from "../../domain/settings/assessment.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import { reportOutputInEffect, type ReportOutput } from "../../domain/settings/report-output.ts";
import type { Result } from "../../domain/result.ts";
import type { CheckReport } from "../../domain/report/check-report.ts";
import { checkLocationsFor } from "../../infrastructure/printed-report/check-locations.ts";
import type { CheckLocations } from "../../application/ports/command/command-arguments.ts";
import type { CheckArguments } from "../../application/ports/command/command-arguments.ts";
import { type CheckRun, checkCommandOutcome } from "../../infrastructure/command-line/outcomes/check-command-outcome.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { type PackageLink, packageLinkOf, UNLINKED } from "../../infrastructure/command-line/installation/package-link.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import { projectCommandOf, pruneCommandOf } from "../../infrastructure/command-line/arguments/tool-invocations.ts";
import { runCheck } from "../../application/run/check/run-check.ts";
import { shownFailureOf } from "../../infrastructure/command-line/installation/shown-path.ts";

type ShownPathsRequest = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: Result<AbsolutePath, LoadFailure>;
};

const installLinkOf = (request: ShownPathsRequest): PackageLink =>
  request.installRoot.outcome === "failed" ? UNLINKED : packageLinkOf({ ...request, installRoot: request.installRoot.value });

export const withShownPaths = <Value>(
  request: ShownPathsRequest & { readonly run: Result<Value, LoadFailure> },
): Result<Value, LoadFailure> =>
  request.run.outcome === "failed"
    ? {
        outcome: "failed",
        error: shownFailureOf({ failure: request.run.error, path: request.path, repoRoot: request.repoRoot, link: installLinkOf(request) }),
      }
    : request.run;

const checkRunOf = (request: {
  readonly report: Result<CheckReport, LoadFailure>;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
}): Result<CheckRun, LoadFailure> =>
  request.report.outcome === "failed"
    ? request.report
    : {
        outcome: "ok",
        value: { report: request.report.value, output: request.output, projectCommand: request.projectCommand, pruneCommand: request.pruneCommand },
      };

const unshownCheckRunAt = async (
  request: Omit<VersionOneCommandRequest, "process"> & {
    readonly arguments: CheckArguments<ReportOutput>;
    readonly repoRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
  },
): Promise<Result<CheckRun, LoadFailure>> => {
  const projectCommand = projectCommandOf({ path: request.path, moduleUrl: request.moduleUrl, repoRoot: request.repoRoot });
  if (projectCommand.outcome === "failed") {
    return projectCommand;
  }
  const pruneCommand = pruneCommandOf({
    path: request.path,
    moduleUrl: request.moduleUrl,
    repoRoot: request.repoRoot,
    baseRevision: request.arguments.baseRevision,
    forfeiture: request.arguments.forfeiture,
  });
  if (pruneCommand.outcome === "failed") {
    return pruneCommand;
  }
  const configured = readRunSettings({ fileText: request.fileText, path: request.path, repoRoot: request.repoRoot });
  if (configured.outcome === "failed") {
    return configured;
  }
  const assessment = assessmentInEffect({
    requested: { forfeiture: request.arguments.forfeiture },
    configured: configured.value.assessment,
  });
  const moduleExtension = moduleExtensionOf({ moduleUrl: request.moduleUrl });
  const report = await runCheck({
    repoRoot: request.repoRoot,
    installRoot: request.installRoot,
    moduleExtension,
    baseRevision: request.arguments.baseRevision,
    assessment,
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
    selectionRepository: createSelectionRepository({ ...request, moduleExtension }),
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot: request.repoRoot }),
  });
  return checkRunOf({
    report,
    output: reportOutputInEffect({ requested: request.arguments.reportOutput, configured: configured.value.reportOutput }),
    projectCommand: projectCommand.value,
    pruneCommand: pruneCommand.value,
  });
};

export type CheckRunAt = (
  request: Omit<VersionOneCommandRequest, "process"> & { readonly locations: CheckLocations },
) => Promise<Result<CheckRun, LoadFailure>>;

export const checkRunAt: CheckRunAt = async (request) => {
  const { path, fileText } = request;
  const { repoRoot, installRoot } = request.locations;
  const run = await unshownCheckRunAt({ ...request, ...request.locations });
  return run.outcome === "failed"
    ? { outcome: "failed", error: shownFailureOf({ failure: run.error, path, repoRoot, link: packageLinkOf({ path, fileText, repoRoot, installRoot }) }) }
    : run;
};

export const checkRunFromCommand = async (request: VersionOneCommandRequest): Promise<Result<CheckRun, LoadFailure>> => {
  const locations = checkLocationsFor({
    arguments: request.process.arguments,
    path: request.path,
    fileText: request.fileText,
    moduleUrl: request.moduleUrl,
  });
  return locations.outcome === "failed" ? locations : checkRunAt({ ...request, locations: locations.value });
};

export const runCheckCommand = (request: VersionOneCommandRequest): Promise<void> =>
  checkRunFromCommand(request).then((checked) =>
    printOutcome({ process: request.process, outcome: checkCommandOutcome({ result: checked }) }),
  );
