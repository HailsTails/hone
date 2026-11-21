import type { MechanismId } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";

export type UnprojectedFolder = {
  readonly mechanism: MechanismId;
  readonly folder: RepoPath;
  readonly selectionFolder: RepoPath;
};
