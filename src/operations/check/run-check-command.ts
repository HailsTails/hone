import type { CheckArguments } from "../../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../../application/ports/command/repository-located.ts";
import { moduleExtensionOf } from "../../application/ports/host/module-extension.ts";
import type { RunSettingsOf } from "../../application/ports/selection/selection-repository.ts";
import type { VersionOneCommandPorts } from "../../application/ports/version-one-command-request.ts";
import { runCheck } from "../../application/run/check/run-check.ts";
import type { CheckOutcome } from "../../domain/report/check-outcome.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import { assessmentInEffect } from "../../domain/settings/assessment.ts";
import { reportOutputInEffect, type ReportOutput } from "../../domain/settings/report-output.ts";

export type CheckInput = VersionOneCommandPorts &
  RepositoryLocated & {
    readonly arguments: CheckArguments<ReportOutput>;
    readonly runSettingsOf: RunSettingsOf;
  };

export const checkOf = async (request: CheckInput): Promise<Result<CheckOutcome, LoadFailure>> => {
  const { repoRoot, installRoot, fileText, path } = request;
  const configured = request.runSettingsOf({ repoRoot });
  if (configured.outcome === "failed") {
    return configured;
  }
  const moduleExtension = moduleExtensionOf({ moduleUrl: request.moduleUrl });
  const report = await runCheck({
    repoRoot,
    installRoot,
    moduleExtension,
    baseRevision: request.arguments.baseRevision,
    assessment: assessmentInEffect({
      requested: { forfeiture: request.arguments.forfeiture },
      configured: configured.value.assessment,
    }),
    fileText,
    modules: request.modules,
    engine: request.engine,
    path,
    git: request.git,
    selectionRepository: request.selectionRepositoryOf({
      repoRoot,
      installRoot,
      moduleExtension,
      fileText,
      path,
    }),
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot }),
    exceptionEntryParser: request.exceptionEntryParser,
    shownPathOf: request.shownPathOfRepository({ path, fileText, repoRoot, installRoot }),
  });
  return report.outcome === "failed"
    ? report
    : {
        outcome: "ok",
        value: {
          report: report.value,
          output: reportOutputInEffect({
            requested: request.arguments.reportOutput,
            configured: configured.value.reportOutput,
          }),
        },
      };
};
