import type { EngineBindings } from "../../domain/language-layer/catalogue-binding.ts";
import type { CheckContent } from "../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";

export type EngineBindingsRepository = {
  readonly read: (request: {
    readonly checks: readonly CheckContent[];
  }) => Result<EngineBindings, VersionTwoLoadFailure>;
};
