import type { PairTimes, SampleTimes, SpeedMeasure } from "./speed-samples.ts";

export const SPEED_MEASURES: readonly SpeedMeasure[] = [
  "coldCpu",
  "coldWall",
  "warmCpu",
  "warmWall",
];

export const mapSampleTimesToMeasure = (request: {
  readonly times: SampleTimes;
  readonly measure: SpeedMeasure;
}): number => {
  switch (request.measure) {
    case "coldCpu":
      return request.times.cold.cpuMicroseconds;
    case "coldWall":
      return request.times.cold.wallMilliseconds;
    case "warmCpu":
      return request.times.warm.cpuMicroseconds;
    case "warmWall":
      return request.times.warm.wallMilliseconds;
  }
};

export const mapValuesToMedian = (request: { readonly values: readonly number[] }): number => {
  const sorted = request.values.toSorted((left, right) => left - right);
  const middle = sorted.slice(
    Math.floor((sorted.length - 1) / 2),
    Math.floor(sorted.length / 2) + 1,
  );
  return middle.reduce((total, sample) => total + sample, 0) / middle.length;
};

export const mapPairToRatio = (request: {
  readonly pair: PairTimes;
  readonly measure: SpeedMeasure;
}): number =>
  mapSampleTimesToMeasure({ times: request.pair.head, measure: request.measure }) /
  mapSampleTimesToMeasure({ times: request.pair.baseline, measure: request.measure });
