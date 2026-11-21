import type { MechanismId } from "../rule-set/identifier-types.ts";
import type { RepoPath } from "../repository/repo-path-types.ts";

export type UnprojectedFolder = {
  readonly mechanism: MechanismId;
  readonly folder: RepoPath;
  readonly selectionFolder: RepoPath;
};
