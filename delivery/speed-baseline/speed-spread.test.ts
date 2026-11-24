import { describe, expect, it } from "vitest";

import type { PairTimesList } from "./speed-samples.ts";
import { createSpeedSpreads } from "./speed-spread.ts";

describe("createSpeedSpreads", () => {
  it("gives each measure's median pair ratio away from 1, its widest pair, and the whole percent above the median", () => {
    const pairs: PairTimesList = [
      {
        baseline: {
          cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
        },
        head: {
          cold: { cpuMicroseconds: 102.5, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 90, wallMilliseconds: 100 },
        },
      },
      {
        baseline: {
          cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
        },
        head: {
          cold: { cpuMicroseconds: 101.5, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 98, wallMilliseconds: 100 },
        },
      },
      {
        baseline: {
          cold: { cpuMicroseconds: 100, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
        },
        head: {
          cold: { cpuMicroseconds: 120, wallMilliseconds: 100 },
          warm: { cpuMicroseconds: 100, wallMilliseconds: 100 },
        },
      },
    ];

    const spreads = createSpeedSpreads({ pairs });

    expect(spreads).toEqual([
      {
        measure: "coldCpu",
        spreadPercent: expect.closeTo(2.5),
        widestPairPercent: expect.closeTo(20),
        allowancePercent: 3,
      },
      { measure: "coldWall", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
      {
        measure: "warmCpu",
        spreadPercent: expect.closeTo(2),
        widestPairPercent: expect.closeTo(10),
        allowancePercent: 2,
      },
      { measure: "warmWall", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
    ]);
  });
});
