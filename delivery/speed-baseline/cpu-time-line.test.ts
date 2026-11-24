import { describe, expect, it } from "vitest";

import {
  mapCpuUsageToCpuTimeLine,
  mapOutputToCpuTime,
  mapOutputToCheckOutput,
} from "./cpu-time-line.ts";

describe("mapCpuUsageToCpuTimeLine", () => {
  it("writes user plus system microseconds on a marked line of their own", () => {
    const usage = { userMicroseconds: 15_000_000, systemMicroseconds: 234_000 };

    const line = mapCpuUsageToCpuTimeLine({ usage });

    expect(line).toBe("\nhone-speed-baseline-cpu-time-microseconds 15234000\n");
  });
});

describe("mapOutputToCpuTime", () => {
  it("reads the microseconds from the marked line among the check's own output", () => {
    const output =
      "shorthand-name: Shorthand name.\nverdict: fail (partial assessment)\nhone-speed-baseline-cpu-time-microseconds 15234000\n";

    const microseconds = mapOutputToCpuTime({ output });

    expect(microseconds).toEqual({ outcome: "ok", value: 15_234_000 });
  });

  it("names the marked line as missing when no line is marked", () => {
    const output = "Error: Cannot find module 'zod'\n";

    const microseconds = mapOutputToCpuTime({ output });

    expect(microseconds).toEqual({ outcome: "failed", error: { kind: "cpu-time-line-missing" } });
  });

  it("names the marked line as missing when it holds no whole number", () => {
    const output = "hone-speed-baseline-cpu-time-microseconds 15.2\n";

    const microseconds = mapOutputToCpuTime({ output });

    expect(microseconds).toEqual({ outcome: "failed", error: { kind: "cpu-time-line-missing" } });
  });
});

describe("mapOutputToCheckOutput", () => {
  it("drops the line the preload wrote and keeps what the check printed, without trailing blank lines", () => {
    const output =
      "load failure: engine-failed eslint\n\nhone-speed-baseline-cpu-time-microseconds 4311000\n";

    const reported = mapOutputToCheckOutput({ output });

    expect(reported).toBe("load failure: engine-failed eslint");
  });
});
