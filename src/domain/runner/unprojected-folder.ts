import type { RepoPath } from "../repository/repo-path-types.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";

export type UnprojectedFolder = {
  readonly mechanism: EngineId;
  readonly folder: RepoPath;
  readonly selectionFolder: RepoPath;
};
