import type { RepoPath } from "../repository/repo-path-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { Hit, MeasuredPair, NativeException, ProjectionState } from "./runner-result-types.ts";

export type SliceProblem = {
  readonly slice: RepoPath;
  readonly state:
    | "out-of-date"
    | "missing"
    | "not-applied"
    | "unconfigured"
    | "nested-configuration";
};

export type UnprojectedFolderReport = {
  readonly folder: RepoPath;
  readonly selectionFolder: RepoPath;
};

export type MechanismRun = {
  readonly mechanism: EngineId;
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly coverableKinds: readonly NativeException["kind"][];
  readonly projection: "none" | ProjectionState;
  readonly slices: readonly SliceProblem[];
  readonly unprojectedFolders: readonly UnprojectedFolderReport[];
  readonly measured: readonly MeasuredPair[];
};
