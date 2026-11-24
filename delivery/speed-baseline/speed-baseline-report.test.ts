import { describe, expect, it } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import type { SpeedBaselineOutcome } from "./speed-baseline-outcome.ts";
import { mapSpeedBaselineOutcomeToReport } from "./speed-baseline-report.ts";

describe("mapSpeedBaselineOutcomeToReport", () => {
  it("prints the four verdicts and the set-up per sample, and exits 0 when all pass", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "compared",
      verdict: {
        outcome: "pass",
        measures: [
          {
            measure: "coldCpu",
            outcome: "pass",
            baselineMedian: 40_000_000,
            headMedian: 40_000_000,
            ratio: 1,
            allowancePercent: 5,
          },
          {
            measure: "coldWall",
            outcome: "pass",
            baselineMedian: 30_000,
            headMedian: 30_000,
            ratio: 1,
            allowancePercent: 5,
          },
          {
            measure: "warmCpu",
            outcome: "pass",
            baselineMedian: 30_000_000,
            headMedian: 30_000_000,
            ratio: 1,
            allowancePercent: 5,
          },
          {
            measure: "warmWall",
            outcome: "pass",
            baselineMedian: 25_000,
            headMedian: 25_000,
            ratio: 1,
            allowancePercent: 5,
          },
        ],
      },
      setUp: { medianMilliseconds: 21_000, sampleCount: 3 },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out:
        "speed-baseline: cold CPU: pass, baseline median 40000 ms, head median 40000 ms, ratio 1.000, allowance 5%\n" +
        "speed-baseline: cold wall: pass, baseline median 30000 ms, head median 30000 ms, ratio 1.000, allowance 5%\n" +
        "speed-baseline: warm CPU: pass, baseline median 30000 ms, head median 30000 ms, ratio 1.000, allowance 5%\n" +
        "speed-baseline: warm wall: pass, baseline median 25000 ms, head median 25000 ms, ratio 1.000, allowance 5%\n" +
        "speed-baseline: pass\n" +
        "speed-baseline: set-up per sample: median 21.0 s over 3 samples\n",
      error: "",
      exitCode: 0,
    });
  });

  it("exits 1 when a verdict fails, and names what it left behind", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "compared",
      verdict: {
        outcome: "fail",
        measures: [
          {
            measure: "coldCpu",
            outcome: "fail",
            baselineMedian: 40_000_000,
            headMedian: 48_000_000,
            ratio: 1.2,
            allowancePercent: 5,
          },
        ],
      },
      setUp: { medianMilliseconds: 20_000, sampleCount: 1 },
      leftovers: [
        { kind: "directory-unremoved", directory: absoluteRootOf("/work/copy"), detail: "EBUSY" },
      ],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out:
        "speed-baseline: cold CPU: fail, baseline median 40000 ms, head median 48000 ms, ratio 1.200, allowance 5%\n" +
        "speed-baseline: fail\n" +
        "speed-baseline: set-up per sample: median 20.0 s over 1 samples\n",
      error: "speed-baseline: /work/copy could not be removed: EBUSY\n",
      exitCode: 1,
    });
  });

  it("prints each measure's spread and exits 0 when calibrating", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "calibrated",
      spreads: [
        { measure: "warmWall", spreadPercent: 3.2, widestPairPercent: 7.5, allowancePercent: 4 },
      ],
      setUp: { medianMilliseconds: 20_000, sampleCount: 1 },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out:
        "speed-baseline calibration: warm wall spread 3.2% (widest pair 7.5%), allowance 4%\n" +
        "speed-baseline: set-up per sample: median 20.0 s over 1 samples\n",
      error: "",
      exitCode: 0,
    });
  });

  it("prints the usage and exits 2 when the command line is refused", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "usage-refused",
      refusal: {
        kind: "usage-refused",
        detail: "Unknown option '--pairs'",
        usage: "usage: speed-baseline --repo <dir>\n",
      },
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error: "Unknown option '--pairs'\nusage: speed-baseline --repo <dir>\n",
      exitCode: 2,
    });
  });

  it("names the lockfile it refuses and the two it supports, and exits 3", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "unprepared",
      refusal: {
        side: "head",
        failure: { kind: "lockfile-unsupported", lockfile: "package-lock.json" },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error:
        "speed-baseline: the head was not set up: the target locks with package-lock.json; Hone installs with pnpm-lock.yaml or bun.lock\n",
      exitCode: 3,
    });
  });

  it("refuses with exit 3 when a sample's Hone resolves to a different file from its side's install", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "unprepared",
      refusal: {
        side: "head",
        failure: {
          kind: "hone-outside-install",
          resolved: "/work/large-repo/node_modules/@hailstails/hone/package.json",
          installResolved: "/work/hone-speed-head/node_modules/@hailstails/hone/package.json",
          install: absoluteRootOf("/work/hone-speed-head"),
        },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error:
        "speed-baseline: the head was not set up: Hone resolved to /work/large-repo/node_modules/@hailstails/hone/package.json from the sample, but to /work/hone-speed-head/node_modules/@hailstails/hone/package.json from the side's install /work/hone-speed-head\n",
      exitCode: 3,
    });
  });

  it("names a set-up command's status and output", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "unprepared",
      refusal: {
        side: "baseline",
        failure: {
          kind: "hone-uninstalled",
          command: { kind: "exited", status: 1, output: "error: not in the cache\n" },
        },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error:
        "speed-baseline: the baseline was not set up: Hone could not be installed into the target's copy: exited 1: error: not in the cache\n",
      exitCode: 3,
    });
  });

  it("exits 1 when only the head could not check", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "check-failed",
      repo: absoluteRootOf("/work/large-repo"),
      runs: {
        baseline: {
          outcome: "ok",
          value: {
            cold: { cpuMicroseconds: 1, wallMilliseconds: 1 },
            warm: { cpuMicroseconds: 1, wallMilliseconds: 1 },
          },
        },
        head: { outcome: "failed", error: { kind: "check-exited", status: 2, output: "crash" } },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error: "speed-baseline: the head could not check /work/large-repo: exited 2: crash\n",
      exitCode: 1,
    });
  });

  it("advises re-pinning and exits 3 when the baseline could not check and the head could", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "check-failed",
      repo: absoluteRootOf("/work/large-repo"),
      runs: {
        baseline: {
          outcome: "failed",
          error: { kind: "check-exited", status: 2, output: "old records" },
        },
        head: {
          outcome: "ok",
          value: {
            cold: { cpuMicroseconds: 1, wallMilliseconds: 1 },
            warm: { cpuMicroseconds: 1, wallMilliseconds: 1 },
          },
        },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error:
        "speed-baseline: the baseline could not check /work/large-repo: exited 2: old records\nre-pin the baseline\n",
      exitCode: 3,
    });
  });

  it("names one failure for both sides, and exits 3, when they exited with the same status", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "check-failed",
      repo: absoluteRootOf("/work/large-repo"),
      runs: {
        baseline: {
          outcome: "failed",
          error: { kind: "check-exited", status: 2, output: "no config" },
        },
        head: {
          outcome: "failed",
          error: { kind: "check-exited", status: 2, output: "no config file" },
        },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error: "speed-baseline: both sides failed to check /work/large-repo: exited 2: no config\n",
      exitCode: 3,
    });
  });

  it("names each side's failure, and exits 3, when they failed differently", () => {
    const outcome: SpeedBaselineOutcome = {
      kind: "check-failed",
      repo: absoluteRootOf("/work/large-repo"),
      runs: {
        baseline: { outcome: "failed", error: { kind: "cpu-time-missing" } },
        head: { outcome: "failed", error: { kind: "check-exited", status: 2, output: "crash" } },
      },
      leftovers: [],
    };

    const report = mapSpeedBaselineOutcomeToReport({ outcome });

    expect(report).toEqual({
      out: "",
      error:
        "speed-baseline: the head could not check /work/large-repo: exited 2: crash\nspeed-baseline: the baseline could not check /work/large-repo: printed no CPU time\n",
      exitCode: 3,
    });
  });
});
