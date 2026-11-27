import type { CheckArguments } from "../../application/ports/command/command-arguments.ts";
import {
  createVersionTwoPlan,
  versionTwoInputsOf,
  type VersionTwoRun,
  type VersionTwoStages,
  versionTwoRunOver,
} from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { Result } from "../../domain/result.ts";
import { assessmentInEffect } from "../../domain/settings/assessment.ts";
import {
  type VersionTwoReportOutput,
  reportOutputInEffect,
} from "../../domain/settings/report-output.ts";

export type VersionTwoCheckInput = {
  readonly stages: VersionTwoStages;
  readonly arguments: Pick<CheckArguments<VersionTwoReportOutput>, "forfeiture" | "reportOutput">;
};

export const versionTwoCheckOf = async (
  request: VersionTwoCheckInput,
): Promise<Result<VersionTwoRun, RunLoadFailure>> => {
  const inputs = versionTwoInputsOf(request);
  if (inputs.outcome === "failed") return inputs;
  const configured = inputs.value.settings.runSettings;
  return versionTwoRunOver({
    stages: request.stages,
    inputs: inputs.value,
    plan: createVersionTwoPlan({
      assessment: assessmentInEffect({
        requested: request.arguments,
        configured: configured.assessment,
      }),
      reportOutput: reportOutputInEffect({
        requested: request.arguments.reportOutput,
        configured: configured.reportOutput,
      }),
      measuring: "when-debt-held",
    }),
  });
};
