import type { SpeedSide } from "./speed-samples.ts";

const PAIRS_PER_CYCLE = 2;

export const createPairOrder = (request: {
  readonly pairIndex: number;
}): readonly [SpeedSide, SpeedSide] =>
  request.pairIndex % PAIRS_PER_CYCLE === 0 ? ["baseline", "head"] : ["head", "baseline"];
