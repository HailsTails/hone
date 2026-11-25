import { describe, expect, it, vi } from "vitest";

import {
  createCpuUsagePort,
  createEnvironmentVariablePort,
  createProcessEndPort,
  type RunningProcessSurface,
} from "./process-adapter.ts";

describe("createProcessEndPort run", () => {
  it("registers the listener for the process's exit", () => {
    const onExit = vi.fn<RunningProcessSurface["onExit"]>();
    const listener = vi.fn<() => void>();

    createProcessEndPort({ processSurface: { onExit } }).run({ listener });

    expect(onExit.mock.calls).toEqual([[{ listener }]]);
  });
});

describe("createCpuUsagePort read", () => {
  it("reads the process's user and system CPU time in microseconds", () => {
    const cpuUsage = vi
      .fn<RunningProcessSurface["cpuUsage"]>()
      .mockReturnValue({ user: 15_000_000, system: 234_000 });

    const usage = createCpuUsagePort({ processSurface: { cpuUsage } }).read();

    expect(usage).toEqual({ userMicroseconds: 15_000_000, systemMicroseconds: 234_000 });
  });
});

describe("createEnvironmentVariablePort read", () => {
  it("reads the named environment variable", () => {
    const variables = createEnvironmentVariablePort({
      processSurface: { environment: { shell: "/bin/sh" } },
    });

    const shell = variables.read({ name: "shell" });

    expect(shell).toBe("/bin/sh");
  });

  it("reads nothing for an unset variable", () => {
    const variables = createEnvironmentVariablePort({ processSurface: { environment: {} } });

    const shell = variables.read({ name: "shell" });

    expect(shell).toBeUndefined();
  });
});
