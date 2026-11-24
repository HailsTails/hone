export type SpeedSide = "baseline" | "head";

export type SpeedMeasure = "coldCpu" | "coldWall" | "warmCpu" | "warmWall";

export type CheckTime = { readonly cpuMicroseconds: number; readonly wallMilliseconds: number };

export type SampleTimes = { readonly cold: CheckTime; readonly warm: CheckTime };

export type PairTimes = Readonly<Record<SpeedSide, SampleTimes>>;

export type PairTimesList = readonly [...PairTimes[], PairTimes];
