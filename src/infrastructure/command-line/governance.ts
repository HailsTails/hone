import type { Hit, NativeException } from "../engines/protocol/runner-module/runner-result-schema.ts";
import type { MechanismId } from "../hone-config-file/identifiers.ts";

export type Finding = Hit & { readonly mechanism: MechanismId };

export type GovernedRun = {
  readonly mechanism: MechanismId;
  readonly nativeExceptions: readonly NativeException[];
  readonly coverableKinds: readonly NativeException["kind"][];
};

export type AttributedNativeException = NativeException & {
  readonly mechanism: MechanismId;
};
