import { describe, expect, it } from "vitest";

import type { SpeedMeasure } from "./speed-samples.ts";
import { mapPairToRatio, mapSampleTimesToMeasure, mapValuesToMedian } from "./speed-statistics.ts";

describe("mapValuesToMedian", () => {
  it.each([
    { values: [130, 101, 104], median: 104 },
    { values: [4, 1, 3, 2], median: 2.5 },
  ])("takes the middle of $values", ({ values, median }) => {
    const request = { values };

    const middle = mapValuesToMedian(request);

    expect(middle).toBe(median);
  });
});

describe("mapSampleTimesToMeasure", () => {
  it.each([
    { measure: "coldCpu", time: 100 },
    { measure: "coldWall", time: 200 },
    { measure: "warmCpu", time: 50 },
    { measure: "warmWall", time: 80 },
  ] satisfies readonly { readonly measure: SpeedMeasure; readonly time: number }[])(
    "selects the $measure time",
    ({ measure, time }) => {
      const times = {
        cold: { cpuMicroseconds: 100, wallMilliseconds: 200 },
        warm: { cpuMicroseconds: 50, wallMilliseconds: 80 },
      };

      const selected = mapSampleTimesToMeasure({ times, measure });

      expect(selected).toBe(time);
    },
  );
});

describe("mapPairToRatio", () => {
  it("divides the head's time by the baseline's for the measure", () => {
    const pair = {
      baseline: {
        cold: { cpuMicroseconds: 100, wallMilliseconds: 200 },
        warm: { cpuMicroseconds: 50, wallMilliseconds: 80 },
      },
      head: {
        cold: { cpuMicroseconds: 125, wallMilliseconds: 200 },
        warm: { cpuMicroseconds: 50, wallMilliseconds: 80 },
      },
    };

    const ratio = mapPairToRatio({ pair, measure: "coldCpu" });

    expect(ratio).toBe(1.25);
  });
});
