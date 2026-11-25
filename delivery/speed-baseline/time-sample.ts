import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { HoneCheckFailure } from "./hone-check-port.ts";
import type { SpeedBaselinePorts } from "./speed-baseline-ports.ts";
import type { CheckTime, SampleTimes } from "./speed-samples.ts";

type TimedCheck = {
  readonly ports: Pick<SpeedBaselinePorts, "checks" | "clock">;
  readonly temporaryFolder: AbsolutePath;
  readonly command: AbsolutePath;
  readonly copy: AbsolutePath;
  readonly baseRevision: string;
};

const runTimedCheck = (request: TimedCheck): Result<CheckTime, HoneCheckFailure> => {
  const started = request.ports.clock.read();
  const run = request.ports.checks.run({
    command: request.command,
    repo: request.copy,
    baseRevision: request.baseRevision,
    temporaryFolder: request.temporaryFolder,
  });
  const ended = request.ports.clock.read();
  return run.outcome === "failed"
    ? run
    : { outcome: "ok", value: { cpuMicroseconds: run.value, wallMilliseconds: ended - started } };
};

export const timeSample = (request: TimedCheck): Result<SampleTimes, HoneCheckFailure> => {
  const cold = runTimedCheck(request);
  if (cold.outcome === "failed") return cold;
  const warm = runTimedCheck(request);
  return warm.outcome === "failed"
    ? warm
    : { outcome: "ok", value: { cold: cold.value, warm: warm.value } };
};
