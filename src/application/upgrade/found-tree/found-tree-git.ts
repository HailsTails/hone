import type { FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import type { BaseFileText, GitContentQuery, GitPort } from "../../../infrastructure/git/git-port.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import type { PathPort } from "../../../infrastructure/node/path-port.ts";
import type { Result } from "../../../domain/result.ts";

type TreeReach = { readonly fileText: Pick<FileTextPort, "read" | "exists">; readonly path: PathPort };

const locationOf = (request: TreeReach & { readonly query: GitContentQuery }): string =>
  request.path.join({ segments: [request.query.repoRoot, request.query.file] });

const textInTreeOf = (request: TreeReach & { readonly query: GitContentQuery }): Result<BaseFileText, GitFailure> => {
  const path = locationOf(request);
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: { presence: "absent-from-base" } };
  }
  const read = request.fileText.read({ path });
  return read.outcome === "ok"
    ? { outcome: "ok", value: { presence: "present-in-base", text: read.value } }
    : { outcome: "failed", error: { kind: "git-failed", command: "read the tree the upgrade found", detail: read.error.detail } };
};

export const foundTreeGitOf = (request: { readonly git: GitPort } & TreeReach): GitPort => ({
  trackedPaths: request.git.trackedPaths,
  changedSince: () => ({ outcome: "ok", value: [] }),
  contentInBase: (query) => ({
    outcome: "ok",
    value: request.fileText.exists({ path: locationOf({ ...request, query }) }) === "present" ? "present-in-base" : "absent-from-base",
  }),
  textInBase: (query) => textInTreeOf({ ...request, query }),
  renamedSince: () => ({ outcome: "ok", value: new Map() }),
});
