import type { Hit, NativeException } from "../runner/runner-result-types.ts";
import type { MechanismId } from "../rule-set/identifier-types.ts";

export type Finding = Hit & { readonly mechanism: MechanismId };

export type GovernedRun = {
  readonly mechanism: MechanismId;
  readonly nativeExceptions: readonly NativeException[];
  readonly coverableKinds: readonly NativeException["kind"][];
};

export type AttributedNativeException = NativeException & {
  readonly mechanism: MechanismId;
};
