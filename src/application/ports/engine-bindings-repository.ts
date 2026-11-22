import type { EngineBindings } from "../../domain/language-layer/catalogue-binding.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";

export type EngineBindingsRepository = {
  readonly read: (request: Record<string, never>) => Result<EngineBindings, VersionTwoLoadFailure>;
};
