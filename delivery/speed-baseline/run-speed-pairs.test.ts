import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { type RunSampleStage, runSpeedPairs } from "./run-speed-pairs.ts";
import type { Leftover } from "./speed-baseline-outcome.ts";

describe("runSpeedPairs", () => {
  it("runs one sample per side per pair, in ABBA order, each with its side's install", () => {
    const times = {
      cold: { cpuMicroseconds: 100, wallMilliseconds: 10 },
      warm: { cpuMicroseconds: 50, wallMilliseconds: 5 },
    };
    const installs = {
      baseline: {
        directory: absoluteRootOf("/work/baseline"),
        command: absoluteRootOf("/work/baseline/hone.js"),
        resolvedHone: "/work/baseline/node_modules/hone",
      },
      head: {
        directory: absoluteRootOf("/work/head"),
        command: absoluteRootOf("/work/head/hone.js"),
        resolvedHone: "/work/head/node_modules/hone",
      },
    };
    const runSample = vi
      .fn<RunSampleStage>()
      .mockReturnValue({ kind: "measured", times, setUpMilliseconds: 1, leftovers: [] });

    runSpeedPairs({ runSample, installs, pairCount: 2 });

    expect(runSample.mock.calls).toEqual([
      [{ side: "baseline", sampleIndex: 0, install: installs.baseline }],
      [{ side: "head", sampleIndex: 0, install: installs.head }],
      [{ side: "head", sampleIndex: 1, install: installs.head }],
      [{ side: "baseline", sampleIndex: 1, install: installs.baseline }],
    ]);
  });

  it("pairs each side's times by side, whichever side ran first, and gathers set-up times and leftovers in run order", () => {
    const times = {
      cold: { cpuMicroseconds: 100, wallMilliseconds: 10 },
      warm: { cpuMicroseconds: 50, wallMilliseconds: 5 },
    };
    const installs = {
      baseline: {
        directory: absoluteRootOf("/work/baseline"),
        command: absoluteRootOf("/work/baseline/hone.js"),
        resolvedHone: "/work/baseline/node_modules/hone",
      },
      head: {
        directory: absoluteRootOf("/work/head"),
        command: absoluteRootOf("/work/head/hone.js"),
        resolvedHone: "/work/head/node_modules/hone",
      },
    };
    const slower = {
      cold: { cpuMicroseconds: 200, wallMilliseconds: 20 },
      warm: { cpuMicroseconds: 90, wallMilliseconds: 9 },
    };
    const leftover: Leftover = {
      kind: "directory-unremoved",
      directory: absoluteRootOf("/work/head/samples/1"),
      detail: "EBUSY",
    };
    const runSample = vi
      .fn<RunSampleStage>()
      .mockReturnValueOnce({ kind: "measured", times, setUpMilliseconds: 1, leftovers: [] })
      .mockReturnValueOnce({ kind: "measured", times: slower, setUpMilliseconds: 2, leftovers: [] })
      .mockReturnValueOnce({
        kind: "measured",
        times: slower,
        setUpMilliseconds: 3,
        leftovers: [leftover],
      })
      .mockReturnValueOnce({ kind: "measured", times, setUpMilliseconds: 4, leftovers: [] });

    const pairs = runSpeedPairs({ runSample, installs, pairCount: 2 });

    expect(pairs).toEqual({
      run: {
        kind: "measured",
        pairs: [
          { baseline: times, head: slower },
          { baseline: times, head: slower },
        ],
      },
      setUpMilliseconds: [1, 2, 3, 4],
      leftovers: [leftover],
    });
  });

  it("stops after the pair in which a check failed, keeping both sides' results", () => {
    const times = {
      cold: { cpuMicroseconds: 100, wallMilliseconds: 10 },
      warm: { cpuMicroseconds: 50, wallMilliseconds: 5 },
    };
    const installs = {
      baseline: {
        directory: absoluteRootOf("/work/baseline"),
        command: absoluteRootOf("/work/baseline/hone.js"),
        resolvedHone: "/work/baseline/node_modules/hone",
      },
      head: {
        directory: absoluteRootOf("/work/head"),
        command: absoluteRootOf("/work/head/hone.js"),
        resolvedHone: "/work/head/node_modules/hone",
      },
    };
    const runSample = vi
      .fn<RunSampleStage>()
      .mockReturnValueOnce({ kind: "measured", times, setUpMilliseconds: 1, leftovers: [] })
      .mockReturnValueOnce({
        kind: "check-failed",
        failure: { kind: "check-exited", status: 2, output: "crash" },
        leftovers: [],
      });

    const pairs = runSpeedPairs({ runSample, installs, pairCount: 5 });

    expect({ pairs, samples: runSample.mock.calls.length }).toEqual({
      pairs: {
        run: {
          kind: "check-failed",
          runs: {
            baseline: { outcome: "ok", value: times },
            head: {
              outcome: "failed",
              error: { kind: "check-exited", status: 2, output: "crash" },
            },
          },
        },
        setUpMilliseconds: [1],
        leftovers: [],
      },
      samples: 2,
    });
  });

  it("stops before the second side when the first side's sample cannot be set up", () => {
    const installs = {
      baseline: {
        directory: absoluteRootOf("/work/baseline"),
        command: absoluteRootOf("/work/baseline/hone.js"),
        resolvedHone: "/work/baseline/node_modules/hone",
      },
      head: {
        directory: absoluteRootOf("/work/head"),
        command: absoluteRootOf("/work/head/hone.js"),
        resolvedHone: "/work/head/node_modules/hone",
      },
    };
    const runSample = vi.fn<RunSampleStage>().mockReturnValue({
      kind: "unprepared",
      refusal: {
        side: "baseline",
        failure: { kind: "package-manifest-unresolved", detail: "missing" },
      },
      leftovers: [],
    });

    const pairs = runSpeedPairs({ runSample, installs, pairCount: 5 });

    expect({ pairs, samples: runSample.mock.calls.length }).toEqual({
      pairs: {
        run: {
          kind: "unprepared",
          refusal: {
            side: "baseline",
            failure: { kind: "package-manifest-unresolved", detail: "missing" },
          },
          leftovers: [],
        },
        setUpMilliseconds: [],
        leftovers: [],
      },
      samples: 1,
    });
  });
});
