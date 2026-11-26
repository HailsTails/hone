import type { CheckArguments } from "../../application/ports/command/command-arguments.ts";
import {
  type VersionTwoRun,
  type VersionTwoStages,
  versionTwoRunOver,
} from "../../application/run/version-two-run.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { VersionTwoReportOutput } from "../../domain/settings/report-output.ts";

export type VersionTwoCheckInput = {
  readonly stages: VersionTwoStages;
  readonly arguments: Pick<
    CheckArguments<VersionTwoReportOutput>,
    "forfeiture" | "reportOutput" | "compareDebtAt"
  >;
};

export const versionTwoCheckOf = (
  request: VersionTwoCheckInput,
): Promise<Result<VersionTwoRun, RunLoadFailure>> =>
  versionTwoRunOver({
    stages: request.stages,
    arguments: {
      forfeiture:
        request.arguments.compareDebtAt === undefined ? request.arguments.forfeiture : "this-run",
      reportOutput: request.arguments.reportOutput,
      measuring: request.arguments.compareDebtAt === undefined ? "when-debt-held" : "always",
      ...(request.arguments.compareDebtAt === undefined
        ? {}
        : { compareDebtAt: request.arguments.compareDebtAt }),
    },
  });
