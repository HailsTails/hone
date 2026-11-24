import type { NamedEngineRun } from "../../../../application/ports/engine/engine-run.ts";
import type { ModuleExtension } from "../../../../application/ports/host/module-extension.ts";
import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import type { RunLoadFailure } from "../../../../domain/report/run-load-failure.ts";
import type { Result } from "../../../../domain/result.ts";
import { createMeasurementEntrySegments } from "../../../node/modules/install-layout.ts";
import {
  createDefaultExecutionPort,
  type ExecutionPolicy,
  type ExecutionPort,
} from "../../../node/process/execution-port.ts";
import {
  createMeasurementArguments,
  decodeMeasuredRuns,
  type MeasurementArguments,
} from "./measurement-wire.ts";

type ChildEnginesLocations = MeasurementArguments & {
  readonly path: Pick<PathPort, "join">;
  readonly moduleExtension: ModuleExtension;
};

type ChildEnginesRequest = ChildEnginesLocations & {
  readonly execution: ExecutionPort<"passed-through", "opened">;
};

const LARGEST_MEASUREMENT_REPLY_BYTES = 256 * 1024 * 1024;

const CHILD_MEASUREMENT_POLICY: ExecutionPolicy<"passed-through", "opened"> = {
  executable: process.execPath,
  environment: ({ ambient }) => ambient,
  timeoutMilliseconds: undefined,
  maximumOutputBytes: LARGEST_MEASUREMENT_REPLY_BYTES,
  stdout: "passed-through",
  replyPipe: "opened",
};

const measureInChild = (
  request: ChildEnginesRequest,
): Result<readonly NamedEngineRun[], RunLoadFailure> => {
  const executed = request.execution.run({
    arguments: [
      request.path.join({ segments: createMeasurementEntrySegments(request) }),
      ...createMeasurementArguments(request),
    ],
  });
  return executed.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "unexpected-error",
          detail: `the measurement process did not finish: ${executed.error.detail}`,
        },
      }
    : decodeMeasuredRuns(executed.value);
};

export const createChildEnginesStage =
  (
    request: ChildEnginesRequest,
  ): (() => Promise<Result<readonly NamedEngineRun[], RunLoadFailure>>) =>
  () =>
    Promise.resolve(measureInChild(request));

export const createDefaultChildEnginesStage = (
  locations: ChildEnginesLocations,
): (() => Promise<Result<readonly NamedEngineRun[], RunLoadFailure>>) =>
  createChildEnginesStage({
    ...locations,
    execution: createDefaultExecutionPort({ policy: CHILD_MEASUREMENT_POLICY }),
  });
