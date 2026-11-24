import type { PairTimesList, SpeedMeasure } from "./speed-samples.ts";
import { mapPairToRatio, mapValuesToMedian, SPEED_MEASURES } from "./speed-statistics.ts";

export type MeasureSpread = {
  readonly measure: SpeedMeasure;
  readonly spreadPercent: number;
  readonly widestPairPercent: number;
  readonly allowancePercent: number;
};

const PERCENT = 100;

const SPREAD_DECIMALS = 6;

export const createSpeedSpreads = (request: {
  readonly pairs: PairTimesList;
}): readonly MeasureSpread[] =>
  SPEED_MEASURES.map((measure) => {
    const ratios = request.pairs.map((pair) => mapPairToRatio({ pair, measure }));
    const spreadPercent = Math.abs(mapValuesToMedian({ values: ratios }) - 1) * PERCENT;
    return {
      measure,
      spreadPercent,
      widestPairPercent: Math.max(...ratios.map((ratio) => Math.abs(ratio - 1))) * PERCENT,
      allowancePercent: Math.ceil(Number(spreadPercent.toFixed(SPREAD_DECIMALS))),
    };
  });
