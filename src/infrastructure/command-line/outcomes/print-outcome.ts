import type { ProcessPort } from "../../node/process/process-port.ts";
import type { CommandOutcome } from "./command-outcome.ts";

export const printOutcome = (request: {
  readonly process: ProcessPort;
  readonly outcome: CommandOutcome;
}): void => {
  request.process.writeOut({ text: request.outcome.text });
  request.process.exitWith({ code: request.outcome.code });
};
