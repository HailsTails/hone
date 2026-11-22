import type { EngineBindings } from "../../domain/language-layer/catalogue-binding.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";

import type { NamedCheckAddress } from "../../domain/rule-set/clause-address-types.ts";

export type EngineBindingsRepository = {
  readonly read: (request: { readonly namedChecks?: readonly NamedCheckAddress[] }) => Result<EngineBindings, VersionTwoLoadFailure>;
};
