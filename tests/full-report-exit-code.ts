import { checkCommandOutcome } from "../src/infrastructure/command-line/outcomes/check-command-outcome.ts";
import type { LoadFailure } from "../src/infrastructure/command-line/load-failure.ts";
import type { ExitCode } from "../src/infrastructure/node/process/process-port.ts";
import type { Result } from "../src/domain/result.ts";
import type { CheckReport } from "../src/domain/report/check-report.ts";

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

export const fullReportExitCode = (request: { readonly checked: Result<CheckReport, LoadFailure> }): ExitCode =>
  checkCommandOutcome({
    result:
      request.checked.outcome === "failed"
        ? request.checked
        : { outcome: "ok", value: { report: request.checked.value, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } },
  }).code;
