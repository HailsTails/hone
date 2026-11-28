import type { RepoPath } from "./repo-path-types.ts";

export type CheckedTree = {
  readonly tracked: readonly RepoPath[];
  readonly declaredConfigRoots: readonly RepoPath[];
};

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;

export const typescriptFilesOf = (request: {
  readonly tracked: readonly RepoPath[];
}): readonly RepoPath[] =>
  request.tracked.filter((trackedPath) => TYPESCRIPT_FILE.test(trackedPath));
