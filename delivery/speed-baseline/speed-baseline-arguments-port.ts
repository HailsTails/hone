import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type SpeedBaselineMode = "compare" | "calibrate";

export type SpeedBaselineArguments = {
  readonly repo: AbsolutePath;
  readonly mode: SpeedBaselineMode;
};

export type SpeedBaselineUsageRefusal = {
  readonly kind: "usage-refused";
  readonly detail: string;
  readonly usage: string;
};

export type SpeedBaselineArgumentsPort = {
  readonly read: () => Result<SpeedBaselineArguments, SpeedBaselineUsageRefusal>;
};
