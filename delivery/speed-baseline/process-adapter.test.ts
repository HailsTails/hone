import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  createCpuUsagePort,
  createEnvironmentVariablePort,
  createProcessEndPort,
} from "./process-adapter.ts";

describe("createProcessEndPort run", () => {
  it("registers the listener for the process's exit", () => {
    const on = vi.spyOn(process, "on").mockReturnValue(process);
    onTestFinished(() => {
      on.mockRestore();
    });
    const listener = vi.fn<() => void>();

    createProcessEndPort().run({ listener });

    expect(on.mock.calls).toEqual([["exit", listener]]);
  });
});

describe("createCpuUsagePort read", () => {
  it("reads this process's user and system CPU time in microseconds", () => {
    const cpuUsage = vi
      .spyOn(process, "cpuUsage")
      .mockReturnValue({ user: 15_000_000, system: 234_000 });
    onTestFinished(() => {
      cpuUsage.mockRestore();
    });

    const usage = createCpuUsagePort().read();

    expect(usage).toEqual({ userMicroseconds: 15_000_000, systemMicroseconds: 234_000 });
  });
});

describe("createEnvironmentVariablePort read", () => {
  it("reads the named environment variable", () => {
    vi.stubEnv("HONE_SPEED_BASELINE_PROBE", "set");
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });

    const probe = createEnvironmentVariablePort().read({ name: "HONE_SPEED_BASELINE_PROBE" });

    expect(probe).toBe("set");
  });

  it("reads nothing for an unset variable", () => {
    vi.stubEnv("HONE_SPEED_BASELINE_PROBE", undefined);
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });

    const probe = createEnvironmentVariablePort().read({ name: "HONE_SPEED_BASELINE_PROBE" });

    expect(probe).toBeUndefined();
  });
});
