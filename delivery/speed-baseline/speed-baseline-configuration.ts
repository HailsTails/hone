import type { SpeedMeasure } from "./speed-samples.ts";

export type SpeedBaselineConfiguration = {
  readonly baselineRevision: string;
  readonly targetBaseRevision: string;
  readonly allowancePercents: Readonly<Record<SpeedMeasure, number>>;
  readonly pairCount: number;
};
