import type { SpeedMeasure } from "./speed-samples.ts";
import type { MeasureSpread } from "./speed-spread.ts";
import type { MeasureVerdict, SpeedVerdict } from "./speed-verdict.ts";

const MICROSECONDS_PER_MILLISECOND = 1000;

const RATIO_DECIMALS = 3;

const SPREAD_DECIMALS = 1;

const MEASURE_NAMES: Readonly<Record<SpeedMeasure, string>> = {
  coldCpu: "cold CPU",
  coldWall: "cold wall",
  warmCpu: "warm CPU",
  warmWall: "warm wall",
};

const mapMeasureValueToMilliseconds = (request: {
  readonly measure: SpeedMeasure;
  readonly value: number;
}): number =>
  Math.round(
    request.measure === "coldCpu" || request.measure === "warmCpu"
      ? request.value / MICROSECONDS_PER_MILLISECOND
      : request.value,
  );

const mapMeasureVerdictToText = (request: { readonly verdict: MeasureVerdict }): string => {
  const { verdict } = request;
  const { measure } = verdict;
  return `speed-baseline: ${MEASURE_NAMES[measure]}: ${verdict.outcome}, baseline median ${mapMeasureValueToMilliseconds({ measure, value: verdict.baselineMedian })} ms, head median ${mapMeasureValueToMilliseconds({ measure, value: verdict.headMedian })} ms, ratio ${verdict.ratio.toFixed(RATIO_DECIMALS)}, allowance ${verdict.allowancePercent}%\n`;
};

export const mapSpeedVerdictToText = (request: { readonly verdict: SpeedVerdict }): string =>
  `${request.verdict.measures.map((verdict) => mapMeasureVerdictToText({ verdict })).join("")}speed-baseline: ${request.verdict.outcome}\n`;

export const mapSpeedSpreadsToText = (request: {
  readonly spreads: readonly MeasureSpread[];
}): string =>
  request.spreads
    .map(
      (spread) =>
        `speed-baseline calibration: ${MEASURE_NAMES[spread.measure]} spread ${spread.spreadPercent.toFixed(SPREAD_DECIMALS)}% (widest pair ${spread.widestPairPercent.toFixed(SPREAD_DECIMALS)}%), allowance ${spread.allowancePercent}%\n`,
    )
    .join("");
