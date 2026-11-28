import type { RepoPath } from "./repo-path-types.ts";

export const excludeProjectionOutputs = (request: {
  readonly files: readonly RepoPath[];
  readonly outputs: ReadonlySet<RepoPath>;
}): readonly RepoPath[] => request.files.filter((file) => !request.outputs.has(file));
