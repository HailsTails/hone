import type { ProjectionWrite } from "../../../domain/runner/runner-result-types.ts";
import type { ExitCode } from "../../../application/ports/host/process-port.ts";
import type { Result } from "../../../domain/result.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { loadFailureText } from "../../printed-report/load-failures/load-failure-text.ts";

export type CommandOutcome = {
  readonly code: ExitCode;
  readonly text: string;
};

const LOAD_FAILURE_CODE = 2;

export const loadFailureOutcome =(request: { readonly failure: LoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: loadFailureText(request),
});

export const projectCommandOutcome = (request: {
  readonly result: Result<readonly ProjectionWrite[], LoadFailure>;
}): CommandOutcome => {
  if (request.result.outcome === "failed") {
    return loadFailureOutcome({ failure: request.result.error });
  }
  return {
    code: 0,
    text: request.result.value.map((write) => `${write.path} ${write.effect}\n`).join(""),
  };
};

export const versionCommandOutcome = (request: { readonly result: Result<string, LoadFailure> }): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : { code: 0, text: `${request.result.value}\n` };

