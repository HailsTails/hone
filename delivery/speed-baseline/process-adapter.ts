import type { CpuUsagePort } from "./cpu-usage-port.ts";
import type { EnvironmentVariablePort } from "./environment-variable-port.ts";
import type { ProcessEndPort } from "./process-end-port.ts";

export type RunningProcessSurface = {
  readonly onExit: (request: { readonly listener: () => void }) => void;
  readonly cpuUsage: () => NodeJS.CpuUsage;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
};

export const createProcessEndPort = (options: {
  readonly processSurface: Pick<RunningProcessSurface, "onExit">;
}): ProcessEndPort => ({
  run: (request) => {
    options.processSurface.onExit({ listener: request.listener });
  },
});

export const createCpuUsagePort = (options: {
  readonly processSurface: Pick<RunningProcessSurface, "cpuUsage">;
}): CpuUsagePort => ({
  read: () => {
    const usage = options.processSurface.cpuUsage();
    return { userMicroseconds: usage.user, systemMicroseconds: usage.system };
  },
});

export const createEnvironmentVariablePort = (options: {
  readonly processSurface: Pick<RunningProcessSurface, "environment">;
}): EnvironmentVariablePort => ({
  read: (request) => options.processSurface.environment[request.name],
});

export const defaultRunningProcessSurface: RunningProcessSurface = {
  onExit: (request) => {
    process.on("exit", request.listener);
  },
  cpuUsage: () => process.cpuUsage(),
  environment: process.env,
};
