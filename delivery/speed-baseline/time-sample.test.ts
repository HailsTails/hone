import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { ClockPort } from "./clock-port.ts";
import type { HoneCheckPort } from "./hone-check-port.ts";
import { timeSample } from "./time-sample.ts";

describe("timeSample", () => {
  it("times a cold then a warm check of the sample with the given command and temporary folder", () => {
    const checkRun = vi
      .fn<HoneCheckPort["run"]>()
      .mockReturnValueOnce({ outcome: "ok", value: 40_000_000 })
      .mockReturnValueOnce({ outcome: "ok", value: 30_000_000 });

    const times = timeSample({
      ports: {
        checks: { run: checkRun },
        clock: {
          read: vi
            .fn<ClockPort["read"]>()
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(30_000)
            .mockReturnValueOnce(30_000)
            .mockReturnValueOnce(55_000),
        },
      },
      temporaryFolder: absoluteRootOf("/work/sample/.tmp"),
      command: absoluteRootOf("/work/head/hone.js"),
      copy: absoluteRootOf("/work/sample"),
      baseRevision: "a4af1c897",
    });

    expect({ times, checked: checkRun.mock.calls }).toEqual({
      times: {
        outcome: "ok",
        value: {
          cold: { cpuMicroseconds: 40_000_000, wallMilliseconds: 30_000 },
          warm: { cpuMicroseconds: 30_000_000, wallMilliseconds: 25_000 },
        },
      },
      checked: [
        [
          {
            command: "/work/head/hone.js",
            repo: "/work/sample",
            baseRevision: "a4af1c897",
            temporaryFolder: "/work/sample/.tmp",
          },
        ],
        [
          {
            command: "/work/head/hone.js",
            repo: "/work/sample",
            baseRevision: "a4af1c897",
            temporaryFolder: "/work/sample/.tmp",
          },
        ],
      ],
    });
  });

  it("skips the warm check when the cold check fails", () => {
    const checkRun = vi.fn<HoneCheckPort["run"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "check-exited", status: 2, output: "crash" },
    });

    const times = timeSample({
      ports: {
        checks: { run: checkRun },
        clock: { read: vi.fn<ClockPort["read"]>().mockReturnValue(0) },
      },
      temporaryFolder: absoluteRootOf("/work/sample/.tmp"),
      command: absoluteRootOf("/work/head/hone.js"),
      copy: absoluteRootOf("/work/sample"),
      baseRevision: "a4af1c897",
    });

    expect({ times, checks: checkRun.mock.calls.length }).toEqual({
      times: { outcome: "failed", error: { kind: "check-exited", status: 2, output: "crash" } },
      checks: 1,
    });
  });
});
