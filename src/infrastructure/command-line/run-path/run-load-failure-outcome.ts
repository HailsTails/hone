import { upgradeInvocationOf } from "../arguments/tool-invocations.ts";
import type { CommandOutcome } from "../outcomes/command-outcome.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { runLoadFailureLine } from "../../printed-report/load-failures/load-failure-lines.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";

const LOAD_FAILURE_CODE = 2;

export const upgradeCommandFor = (request: { readonly path: PathPort; readonly moduleUrl: string; readonly repoRoot: AbsolutePath }): string | undefined => {
  const invocation = upgradeInvocationOf(request);
  return invocation.outcome === "ok" ? invocation.value : undefined;
};

export const runLoadFailureOutcomeOf = (request: { readonly failure: RunLoadFailure; readonly upgradeCommand: string | undefined }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: `${runLoadFailureLine({ failure: request.failure, upgradeCommand: request.upgradeCommand })}\n`,
});
