import { assert, describe, expect, it, vi } from "vitest";

import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { CpuUsagePort } from "./cpu-usage-port.ts";
import type { ProcessEndPort } from "./process-end-port.ts";
import { writeCpuTimeAtEnd } from "./write-cpu-time-at-end.ts";

describe("writeCpuTimeAtEnd", () => {
  it("registers one end listener and reads and writes nothing until the process ends", () => {
    const run = vi.fn<ProcessEndPort["run"]>();
    const read = vi.fn<CpuUsagePort["read"]>();
    const writeError = vi.fn<ProcessPort["writeError"]>();

    writeCpuTimeAtEnd({ processEnd: { run }, cpuUsage: { read }, process: { writeError } });

    expect({
      registered: run.mock.calls,
      read: read.mock.calls,
      written: writeError.mock.calls,
    }).toEqual({
      registered: [[{ listener: expect.any(Function) }]],
      read: [],
      written: [],
    });
  });

  it("writes the user plus system CPU time in microseconds when the process ends", () => {
    const run = vi.fn<ProcessEndPort["run"]>();
    const read = vi
      .fn<CpuUsagePort["read"]>()
      .mockReturnValue({ userMicroseconds: 15_000_000, systemMicroseconds: 234_000 });
    const writeError = vi.fn<ProcessPort["writeError"]>();
    writeCpuTimeAtEnd({ processEnd: { run }, cpuUsage: { read }, process: { writeError } });
    const [registration] = run.mock.calls;
    assert(registration !== undefined, "the writer registers an end listener");
    const { listener } = registration[0];

    listener();

    expect({ read: read.mock.calls, written: writeError.mock.calls }).toEqual({
      read: [[]],
      written: [[{ text: "\nhone-speed-baseline-cpu-time-microseconds 15234000\n" }]],
    });
  });
});
