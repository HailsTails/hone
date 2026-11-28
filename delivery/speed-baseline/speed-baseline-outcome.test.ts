import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { mapPairsRunToSpeedBaselineOutcome } from "./speed-baseline-outcome.ts";
import type { createSpeedVerdict } from "./speed-verdict.ts";

describe("mapPairsRunToSpeedBaselineOutcome", () => {
  it("gives the verdict on the measured pairs, with the median set-up time and the leftovers, when comparing", () => {
    const createVerdict = vi
      .fn<typeof createSpeedVerdict>()
      .mockReturnValue({ outcome: "pass", measures: [] });
    const pair = {
      baseline: {
        cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
        warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
      },
      head: {
        cold: { cpuMicroseconds: 110, wallMilliseconds: 100 },
        warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
      },
    };

    const outcome = mapPairsRunToSpeedBaselineOutcome({
      run: { kind: "measured", pairs: [pair] },
      mode: "compare",
      repo: absoluteRootOf("/work/large-repo"),
      allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
      setUpMilliseconds: [12_000, 16_000, 13_000],
      leftovers: [
        { kind: "directory-unremoved", directory: absoluteRootOf("/work/index"), detail: "EPERM" },
      ],
      createVerdict,
    });

    expect({ outcome, judged: createVerdict.mock.calls }).toEqual({
      outcome: {
        kind: "compared",
        verdict: { outcome: "pass", measures: [] },
        setUp: { medianMilliseconds: 13_000, sampleCount: 3 },
        leftovers: [{ kind: "directory-unremoved", directory: "/work/index", detail: "EPERM" }],
      },
      judged: [
        [
          {
            pairs: [pair],
            allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
          },
        ],
      ],
    });
  });

  it("gives each measure's spread, with no verdict, when calibrating", () => {
    const createVerdict = vi.fn<typeof createSpeedVerdict>();

    const outcome = mapPairsRunToSpeedBaselineOutcome({
      run: {
        kind: "measured",
        pairs: [
          {
            baseline: {
              cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
              warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
            },
            head: {
              cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
              warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
            },
          },
        ],
      },
      mode: "calibrate",
      repo: absoluteRootOf("/work/large-repo"),
      allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
      setUpMilliseconds: [12_000],
      leftovers: [],
      createVerdict,
    });

    expect({ outcome, judged: createVerdict.mock.calls }).toEqual({
      outcome: {
        kind: "calibrated",
        spreads: [
          { measure: "coldCpu", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
          { measure: "coldWall", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
          { measure: "warmCpu", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
          { measure: "warmWall", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
        ],
        setUp: { medianMilliseconds: 12_000, sampleCount: 1 },
        leftovers: [],
      },
      judged: [],
    });
  });

  it("keeps each side's check result when a check failed", () => {
    const outcome = mapPairsRunToSpeedBaselineOutcome({
      run: {
        kind: "check-failed",
        runs: {
          baseline: {
            outcome: "ok",
            value: {
              cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
              warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
            },
          },
          head: { outcome: "failed", error: { kind: "check-exited", status: 2, output: "crash" } },
        },
      },
      mode: "compare",
      repo: absoluteRootOf("/work/large-repo"),
      allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
      setUpMilliseconds: [],
      leftovers: [],
      createVerdict: vi.fn<typeof createSpeedVerdict>(),
    });

    expect(outcome).toEqual({
      kind: "check-failed",
      repo: "/work/large-repo",
      runs: {
        baseline: {
          outcome: "ok",
          value: {
            cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
            warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
          },
        },
        head: { outcome: "failed", error: { kind: "check-exited", status: 2, output: "crash" } },
      },
      leftovers: [],
    });
  });
});
