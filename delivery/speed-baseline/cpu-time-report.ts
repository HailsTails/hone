import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { createCpuUsagePort, createProcessEndPort } from "./process-adapter.ts";
import { writeCpuTimeAtEnd } from "./write-cpu-time-at-end.ts";

writeCpuTimeAtEnd({
  processEnd: createProcessEndPort(),
  cpuUsage: createCpuUsagePort(),
  process: createDefaultProcessPort({}),
});
