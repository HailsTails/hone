import type { EngineId } from "../rule-set/identifier-types.ts";
import type { Hit, NativeException } from "../runner/runner-result-types.ts";

export type Finding = Hit & { readonly mechanism: EngineId };

export type GovernedRun = {
  readonly mechanism: EngineId;
  readonly nativeExceptions: readonly NativeException[];
  readonly coverableKinds: readonly NativeException["kind"][];
};

export type AttributedNativeException = NativeException & {
  readonly mechanism: EngineId;
};
