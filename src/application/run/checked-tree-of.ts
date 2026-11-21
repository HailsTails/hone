import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import type { PathPort } from "../../infrastructure/node/path-port.ts";
import type { AbsolutePath } from "../../infrastructure/content-files/absolute-path.ts";
import type { RepoPath } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { LoadFailure } from "../../infrastructure/command-line/load-failure.ts";

export type TreeFailure = Extract<LoadFailure, { readonly kind: "git-failed" } | { readonly kind: "config-root-untracked" }>;

export type CheckedTree = {
  readonly tracked: readonly RepoPath[];
  readonly declaredConfigRoots: readonly RepoPath[];
};

type TreeRequest = {
  readonly git: Pick<GitPort, "trackedPaths">;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly excluded: readonly RepoPath[];
  readonly eslintConfigRoots: readonly RepoPath[];
};

const exclusionOf = (request: { readonly trackedPath: RepoPath; readonly excluded: readonly RepoPath[] }): "excluded" | "checked" =>
  request.excluded.some((excludedPath) => request.trackedPath === excludedPath || request.trackedPath.startsWith(`${excludedPath}/`)) ? "excluded" : "checked";

const presenceOf = (request: TreeRequest & { readonly trackedPath: RepoPath }): "present" | "absent" =>
  request.fileText.exists({ path: request.path.join({ segments: [request.repoRoot, request.trackedPath] }) });

const trackedFolderOf = (request: { readonly folder: RepoPath; readonly tracked: readonly RepoPath[] }): "tracked" | "untracked" =>
  request.tracked.some((trackedPath) => trackedPath.startsWith(`${request.folder}/`)) ? "tracked" : "untracked";

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;

export const typescriptFilesOf = (request: { readonly tracked: readonly RepoPath[] }): readonly RepoPath[] =>
  request.tracked.filter((trackedPath) => TYPESCRIPT_FILE.test(trackedPath));

export const checkedTreeOf = (request: TreeRequest): Result<CheckedTree, TreeFailure> => {
  const listed = request.git.trackedPaths({ repoRoot: request.repoRoot });
  if (listed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "git-failed", detail: `${listed.error.command}: ${listed.error.detail}` } };
  }
  const tracked = listed.value
    .filter((trackedPath) => exclusionOf({ trackedPath, excluded: request.excluded }) === "checked")
    .filter((trackedPath) => presenceOf({ ...request, trackedPath }) === "present");
  const untracked = request.eslintConfigRoots.find((folder) => trackedFolderOf({ folder, tracked }) === "untracked");
  return untracked === undefined
    ? { outcome: "ok", value: { tracked, declaredConfigRoots: request.eslintConfigRoots } }
    : { outcome: "failed", error: { kind: "config-root-untracked", root: untracked } };
};
