import { describe, expect, it } from "vitest";

import type { MeasureSpread } from "./speed-spread.ts";
import { mapSpeedSpreadsToText, mapSpeedVerdictToText } from "./speed-verdict-text.ts";
import type { SpeedVerdict } from "./speed-verdict.ts";

describe("mapSpeedVerdictToText", () => {
  it("states each measure's medians in milliseconds, its ratio, allowance and verdict, then the run's", () => {
    const verdict: SpeedVerdict = {
      outcome: "fail",
      measures: [
        {
          measure: "coldCpu",
          outcome: "pass",
          baselineMedian: 40_000_400,
          headMedian: 41_000_000,
          ratio: 1.02499,
          allowancePercent: 5,
        },
        {
          measure: "coldWall",
          outcome: "pass",
          baselineMedian: 30_000.4,
          headMedian: 30_500,
          ratio: 1.0166,
          allowancePercent: 5,
        },
        {
          measure: "warmCpu",
          outcome: "fail",
          baselineMedian: 30_000_000,
          headMedian: 36_000_000,
          ratio: 1.2,
          allowancePercent: 10,
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
    };

    const text = mapSpeedVerdictToText({ verdict });

    expect(text).toBe(
      "speed-baseline: cold CPU: pass, baseline median 40000 ms, head median 41000 ms, ratio 1.025, allowance 5%\n" +
        "speed-baseline: cold wall: pass, baseline median 30000 ms, head median 30500 ms, ratio 1.017, allowance 5%\n" +
        "speed-baseline: warm CPU: fail, baseline median 30000 ms, head median 36000 ms, ratio 1.200, allowance 10%\n" +
        "speed-baseline: warm wall: pass, baseline median 25000 ms, head median 25000 ms, ratio 1.000, allowance 5%\n" +
        "speed-baseline: fail\n",
    );
  });
});

describe("mapSpeedSpreadsToText", () => {
  it("states each measure's spread and the allowance it gives", () => {
    const spreads: readonly MeasureSpread[] = [
      { measure: "coldCpu", spreadPercent: 2.44, widestPairPercent: 9.5, allowancePercent: 3 },
      { measure: "coldWall", spreadPercent: 6, widestPairPercent: 12, allowancePercent: 6 },
      { measure: "warmCpu", spreadPercent: 1.25, widestPairPercent: 4, allowancePercent: 2 },
      { measure: "warmWall", spreadPercent: 0, widestPairPercent: 0, allowancePercent: 0 },
    ];

    const text = mapSpeedSpreadsToText({ spreads });

    expect(text).toBe(
      "speed-baseline calibration: cold CPU spread 2.4% (widest pair 9.5%), allowance 3%\n" +
        "speed-baseline calibration: cold wall spread 6.0% (widest pair 12.0%), allowance 6%\n" +
        "speed-baseline calibration: warm CPU spread 1.3% (widest pair 4.0%), allowance 2%\n" +
        "speed-baseline calibration: warm wall spread 0.0% (widest pair 0.0%), allowance 0%\n",
    );
  });
});
