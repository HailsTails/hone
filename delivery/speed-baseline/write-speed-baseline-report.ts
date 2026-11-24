import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { SpeedBaselineOutcome } from "./speed-baseline-outcome.ts";
import { mapSpeedBaselineOutcomeToReport } from "./speed-baseline-report.ts";

export const writeSpeedBaselineReport = (request: {
  readonly process: Pick<ProcessPort, "writeOut" | "writeError" | "exitWith">;
  readonly outcome: SpeedBaselineOutcome;
}): void => {
  const report = mapSpeedBaselineOutcomeToReport({ outcome: request.outcome });
  request.process.writeOut({ text: report.out });
  request.process.writeError({ text: report.error });
  request.process.exitWith({ code: report.exitCode });
};
