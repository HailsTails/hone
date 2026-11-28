import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import {
  createDefaultExecutionPort,
  type ExecutionPort,
} from "../../src/infrastructure/node/process/execution-port.ts";
import { mapOutputToCheckOutput, mapOutputToCpuTime } from "./cpu-time-line.ts";
import type { HoneCheckPort } from "./hone-check-port.ts";

const CHECK_VERDICT_STATUSES: readonly number[] = [0, 1];

const TEMPORARY_FOLDER_VARIABLES: readonly string[] = ["TMPDIR", "TEMP", "TMP"];

export const createSampleExecutionPort = (request: {
  readonly temporaryFolder: AbsolutePath;
}): ExecutionPort<"captured", "none"> =>
  createDefaultExecutionPort({
    policy: {
      executable: "node",
      environment: ({ ambient }) => ({
        ...ambient,
        ...Object.fromEntries(
          TEMPORARY_FOLDER_VARIABLES.map((name) => [name, request.temporaryFolder]),
        ),
      }),
      timeoutMilliseconds: undefined,
      maximumOutputBytes: 256 * 1024 * 1024,
      stdout: "captured",
      replyPipe: "none",
    },
  });

export const createHoneCheckPort = (options: {
  readonly createExecution: (request: {
    readonly temporaryFolder: AbsolutePath;
  }) => ExecutionPort<"captured", "none">;
  readonly cpuTimeReportUrl: string;
}): HoneCheckPort => ({
  run: (request) => {
    const run = options.createExecution({ temporaryFolder: request.temporaryFolder }).run({
      arguments: [
        "--import",
        options.cpuTimeReportUrl,
        request.command,
        "check",
        "--repo",
        request.repo,
        "--base-revision",
        request.baseRevision,
      ],
      cwd: request.repo,
    });
    if (run.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "check-unlaunched", detail: run.error.detail },
      };
    }
    if (!CHECK_VERDICT_STATUSES.includes(run.value.status)) {
      return {
        outcome: "failed",
        error: {
          kind: "check-exited",
          status: run.value.status,
          output: mapOutputToCheckOutput({ output: `${run.value.stdout}${run.value.stderr}` }),
        },
      };
    }
    const microseconds = mapOutputToCpuTime({ output: run.value.stderr });
    return microseconds.outcome === "failed"
      ? { outcome: "failed", error: { kind: "cpu-time-missing" } }
      : microseconds;
  },
});
