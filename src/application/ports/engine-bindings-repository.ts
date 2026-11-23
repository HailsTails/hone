import type { EngineBindings } from "../../domain/language-layer/catalogue-binding.ts";
import type { AddressedCheck } from "../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";

export type EngineBindingsRepository = {
  readonly read: (request: {
    readonly checks: readonly AddressedCheck[];
  }) => Result<EngineBindings, VersionTwoLoadFailure>;
};
