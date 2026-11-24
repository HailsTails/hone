import type { CpuUsagePort } from "./cpu-usage-port.ts";
import type { EnvironmentVariablePort } from "./environment-variable-port.ts";
import type { ProcessEndPort } from "./process-end-port.ts";

export const createProcessEndPort = (): ProcessEndPort => ({
  run: (request) => {
    process.on("exit", request.listener);
  },
});

export const createCpuUsagePort = (): CpuUsagePort => ({
  read: () => {
    const usage = process.cpuUsage();
    return { userMicroseconds: usage.user, systemMicroseconds: usage.system };
  },
});

export const createEnvironmentVariablePort = (): EnvironmentVariablePort => ({
  read: (request) => process.env[request.name],
});
