import type { Assessment } from "../../infrastructure/hone-config-file/assessment.ts";

export type RunSettings<Output extends string> = {
  readonly reportOutput: Output;
  readonly assessment: Assessment;
};
