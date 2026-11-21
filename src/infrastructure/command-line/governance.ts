import type { Hit, NativeException } from "../../domain/runner/runner-result-types.ts";
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
