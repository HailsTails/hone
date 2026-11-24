import { describe, expect, it } from "vitest";

import type { Result } from "../../src/domain/result.ts";
import type {
  ExecutionExit,
  ExecutionFailure,
} from "../../src/infrastructure/node/process/execution-port.ts";
import { mapExecutionToCommandResult } from "./command-failure.ts";

describe("mapExecutionToCommandResult", () => {
  it("keeps a successful exit", () => {
    const run: Result<ExecutionExit<"captured", "none">, ExecutionFailure> = {
      outcome: "ok",
      value: { status: 0, stdout: "done\n", stderr: "" },
    };

    const command = mapExecutionToCommandResult({ run });

    expect(command).toEqual({ outcome: "ok", value: { status: 0, stdout: "done\n", stderr: "" } });
  });

  it("carries the status and both outputs of an unsuccessful exit", () => {
    const run: Result<ExecutionExit<"captured", "none">, ExecutionFailure> = {
      outcome: "ok",
      value: { status: 128, stdout: "out\n", stderr: "fatal\n" },
    };

    const command = mapExecutionToCommandResult({ run });

    expect(command).toEqual({
      outcome: "failed",
      error: { kind: "exited", status: 128, output: "out\nfatal\n" },
    });
  });

  it("carries the launch detail when the command could not start", () => {
    const run: Result<ExecutionExit<"captured", "none">, ExecutionFailure> = {
      outcome: "failed",
      error: {
        kind: "launch-failed",
        detail: "spawn git ENOENT",
        stdout: "",
        stderr: "",
        code: "ENOENT",
        signal: undefined,
      },
    };

    const command = mapExecutionToCommandResult({ run });

    expect(command).toEqual({
      outcome: "failed",
      error: { kind: "unlaunched", detail: "spawn git ENOENT" },
    });
  });
});
