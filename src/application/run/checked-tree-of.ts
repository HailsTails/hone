import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { GitPort } from "../ports/git-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { exclusionOf } from "../../domain/repository/exclusion.ts";
import type { LoadFailure } from "../../domain/report/load-failure.ts";

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
    .filter((trackedPath) => exclusionOf({ path: trackedPath, excluded: request.excluded }) === "checked")
    .filter((trackedPath) => presenceOf({ ...request, trackedPath }) === "present");
  const untracked = request.eslintConfigRoots.find((folder) => trackedFolderOf({ folder, tracked }) === "untracked");
  return untracked === undefined
    ? { outcome: "ok", value: { tracked, declaredConfigRoots: request.eslintConfigRoots } }
    : { outcome: "failed", error: { kind: "config-root-untracked", root: untracked } };
};
