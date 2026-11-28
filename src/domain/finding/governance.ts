import type { RepoPath } from "../repository/repo-path-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { OwnedName } from "../rule-set/rule-set-identity.ts";
import type { CheckHit, CheckNativeException } from "../runner/check-observations.ts";
import type { UnprojectedFolderReport } from "../runner/mechanism-run.ts";
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

export type CheckFinding = CheckHit & Pick<OwnedName, "ruleSet"> & { readonly mechanism: EngineId };

export type NamedGovernedRun = {
  readonly mechanism: EngineId;
  readonly nativeExceptions: readonly CheckNativeException[];
  readonly nestedConfigurations: readonly RepoPath[];
  readonly unprojectedFolders: readonly UnprojectedFolderReport[];
  readonly coverableKinds: readonly CheckNativeException["kind"][];
};

export type AttributedCheckException = CheckNativeException & { readonly mechanism: EngineId };
