import type { RepoPath } from "./repo-path-types.ts";

export type CheckedTree = {
  readonly tracked: readonly RepoPath[];
  readonly declaredConfigRoots: readonly RepoPath[];
};
