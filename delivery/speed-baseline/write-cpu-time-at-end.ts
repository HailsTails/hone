import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import { mapCpuUsageToCpuTimeLine } from "./cpu-time-line.ts";
import type { CpuUsagePort } from "./cpu-usage-port.ts";
import type { ProcessEndPort } from "./process-end-port.ts";

const writeCpuTime = (request: {
  readonly cpuUsage: CpuUsagePort;
  readonly process: Pick<ProcessPort, "writeError">;
}): void => {
  request.process.writeError({
    text: mapCpuUsageToCpuTimeLine({ usage: request.cpuUsage.read() }),
  });
};

export const writeCpuTimeAtEnd = (request: {
  readonly processEnd: ProcessEndPort;
  readonly cpuUsage: CpuUsagePort;
  readonly process: Pick<ProcessPort, "writeError">;
}): void => {
  request.processEnd.run({ listener: () => writeCpuTime(request) });
};
