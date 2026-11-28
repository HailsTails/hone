import type { PairTimesList, SpeedMeasure } from "./speed-samples.ts";
import {
  mapPairToRatio,
  mapSampleTimesToMeasure,
  mapValuesToMedian,
  SPEED_MEASURES,
} from "./speed-statistics.ts";

export type MeasureVerdict = {
  readonly measure: SpeedMeasure;
  readonly outcome: "pass" | "fail";
  readonly baselineMedian: number;
  readonly headMedian: number;
  readonly ratio: number;
  readonly allowancePercent: number;
};

export type SpeedVerdict = {
  readonly outcome: "pass" | "fail";
  readonly measures: readonly MeasureVerdict[];
};

const PERCENT = 100;

const createMeasureVerdict = (request: {
  readonly pairs: PairTimesList;
  readonly measure: SpeedMeasure;
  readonly allowancePercent: number;
}): MeasureVerdict => {
  const { pairs, measure } = request;
  const ratio = mapValuesToMedian({
    values: pairs.map((pair) => mapPairToRatio({ pair, measure })),
  });
  return {
    measure,
    outcome: ratio > 1 + request.allowancePercent / PERCENT ? "fail" : "pass",
    baselineMedian: mapValuesToMedian({
      values: pairs.map((pair) => mapSampleTimesToMeasure({ times: pair.baseline, measure })),
    }),
    headMedian: mapValuesToMedian({
      values: pairs.map((pair) => mapSampleTimesToMeasure({ times: pair.head, measure })),
    }),
    ratio,
    allowancePercent: request.allowancePercent,
  };
};

export const createSpeedVerdict = (request: {
  readonly pairs: PairTimesList;
  readonly allowancePercents: Readonly<Record<SpeedMeasure, number>>;
}): SpeedVerdict => {
  const measures = SPEED_MEASURES.map((measure) =>
    createMeasureVerdict({
      pairs: request.pairs,
      measure,
      allowancePercent: request.allowancePercents[measure],
    }),
  );
  return {
    outcome: measures.some((measure) => measure.outcome === "fail") ? "fail" : "pass",
    measures,
  };
};
