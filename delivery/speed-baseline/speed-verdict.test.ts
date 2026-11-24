import { describe, expect, it } from "vitest";

import type { PairTimesList } from "./speed-samples.ts";
import { createSpeedVerdict } from "./speed-verdict.ts";

describe("createSpeedVerdict", () => {
  it("passes every measure whose median pair ratio is within its allowance", () => {
    const pairs: PairTimesList = [
      {
        baseline: {
          cold: { cpuMicroseconds: 100, wallMilliseconds: 200 },
          warm: { cpuMicroseconds: 50, wallMilliseconds: 80 },
        },
        head: {
          cold: { cpuMicroseconds: 105, wallMilliseconds: 210 },
          warm: { cpuMicroseconds: 50, wallMilliseconds: 84 },
        },
      },
    ];

    const verdict = createSpeedVerdict({
      pairs,
      allowancePercents: { coldCpu: 5, coldWall: 5, warmCpu: 5, warmWall: 5 },
    });

    expect(verdict).toEqual({
      outcome: "pass",
      measures: [
        {
          measure: "coldCpu",
          outcome: "pass",
          baselineMedian: 100,
          headMedian: 105,
          ratio: 1.05,
          allowancePercent: 5,
        },
        {
          measure: "coldWall",
          outcome: "pass",
          baselineMedian: 200,
          headMedian: 210,
          ratio: 1.05,
          allowancePercent: 5,
        },
        {
          measure: "warmCpu",
          outcome: "pass",
          baselineMedian: 50,
          headMedian: 50,
          ratio: 1,
          allowancePercent: 5,
        },
        {
          measure: "warmWall",
          outcome: "pass",
          baselineMedian: 80,
          headMedian: 84,
          ratio: 1.05,
          allowancePercent: 5,
        },
      ],
    });
  });

  it("fails the run when one measure's median pair ratio is past its allowance", () => {
    const pairs: PairTimesList = [
      {
        baseline: {
          cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
        },
        head: {
          cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 100, wallMilliseconds: 120 },
        },
      },
    ];

    const verdict = createSpeedVerdict({
      pairs,
      allowancePercents: { coldCpu: 10, coldWall: 10, warmCpu: 10, warmWall: 15 },
    });

    expect(verdict).toEqual({
      outcome: "fail",
      measures: [
        {
          measure: "coldCpu",
          outcome: "pass",
          baselineMedian: 100,
          headMedian: 100,
          ratio: 1,
          allowancePercent: 10,
        },
        {
          measure: "coldWall",
          outcome: "pass",
          baselineMedian: 100,
          headMedian: 100,
          ratio: 1,
          allowancePercent: 10,
        },
        {
          measure: "warmCpu",
          outcome: "pass",
          baselineMedian: 100,
          headMedian: 100,
          ratio: 1,
          allowancePercent: 10,
        },
        {
          measure: "warmWall",
          outcome: "fail",
          baselineMedian: 100,
          headMedian: 120,
          ratio: 1.2,
          allowancePercent: 15,
        },
      ],
    });
  });
});
