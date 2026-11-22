import type { RepoPath } from "./repo-path-types.ts";

export type Exclusion = "excluded" | "checked";

export const exclusionOf = (request: {
  readonly path: RepoPath;
  readonly excluded: readonly RepoPath[];
}): Exclusion =>
  request.excluded.some(
    (excludedPath) => request.path === excludedPath || request.path.startsWith(`${excludedPath}/`),
  )
    ? "excluded"
    : "checked";
