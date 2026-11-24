import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { BaseFileText, GitContentQuery, GitPort } from "../../ports/git-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";

export type FoundTreeChanges = {
  readonly written: readonly RepoPath[];
  readonly removed: readonly RepoPath[];
};

type TreeReach = {
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly path: PathPort;
};

const locationOf = (request: TreeReach & { readonly query: GitContentQuery }): string =>
  request.path.join({ segments: [request.query.repoRoot, request.query.file] });

const textInTreeOf = (
  request: TreeReach & { readonly query: GitContentQuery },
): Result<BaseFileText, GitFailure> => {
  const path = locationOf(request);
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: { presence: "absent-from-base" } };
  }
  const read = request.fileText.read({ path });
  return read.outcome === "ok"
    ? { outcome: "ok", value: { presence: "present-in-base", text: read.value } }
    : {
        outcome: "failed",
        error: {
          kind: "git-failed",
          command: "read the tree the upgrade found",
          detail: read.error.detail,
        },
      };
};

const mapTrackedToUpgraded = (
  request: FoundTreeChanges & {
    readonly tracked: Result<readonly RepoPath[], GitFailure>;
  },
): Result<readonly RepoPath[], GitFailure> => {
  if (request.tracked.outcome === "failed") {
    return request.tracked;
  }
  const kept = request.tracked.value.filter((path) => !request.removed.includes(path));
  return { outcome: "ok", value: [...new Set([...kept, ...request.written])] };
};

export const foundTreeGitOf = (
  request: { readonly git: GitPort } & FoundTreeChanges & TreeReach,
): GitPort => ({
  trackedPaths: (query) =>
    mapTrackedToUpgraded({
      tracked: request.git.trackedPaths(query),
      written: request.written,
      removed: request.removed,
    }),
  changedSince: () => ({ outcome: "ok", value: [] }),
  contentInBase: (query) => ({
    outcome: "ok",
    value:
      request.fileText.exists({ path: locationOf({ ...request, query }) }) === "present"
        ? "present-in-base"
        : "absent-from-base",
  }),
  textInBase: (query) => textInTreeOf({ ...request, query }),
  renamedSince: () => ({ outcome: "ok", value: new Map() }),
});
