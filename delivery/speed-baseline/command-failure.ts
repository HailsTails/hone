import type { Result } from "../../src/domain/result.ts";
import type {
  ExecutionExit,
  ExecutionFailure,
} from "../../src/infrastructure/node/process/execution-port.ts";

export type CommandFailure =
  | { readonly kind: "exited"; readonly status: number; readonly output: string }
  | { readonly kind: "unlaunched"; readonly detail: string };

export const SUCCESSFUL_EXIT_STATUS = 0;

export const mapExecutionToCommandResult = (request: {
  readonly run: Result<ExecutionExit<"captured", "none">, ExecutionFailure>;
}): Result<ExecutionExit<"captured", "none">, CommandFailure> => {
  const { run } = request;
  if (run.outcome === "failed") {
    return { outcome: "failed", error: { kind: "unlaunched", detail: run.error.detail } };
  }
  return run.value.status === SUCCESSFUL_EXIT_STATUS
    ? run
    : {
        outcome: "failed",
        error: {
          kind: "exited",
          status: run.value.status,
          output: `${run.value.stdout}${run.value.stderr}`,
        },
      };
};
