import type { FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../../../infrastructure/node/path-port.ts";
import type { AbsolutePath } from "../../../infrastructure/content-files/absolute-path.ts";
import { gatheredOutcomes, listedOutcome } from "../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import { projectionImportingOf } from "../writing/config-import-rewrite.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";

export type VersionOneProjection = { readonly projection: RepoPath; readonly teamConfigs: readonly PlannedRepoFile[] };

export type TeamConfigRefusal =
  | { readonly kind: "no-file-imports-projection"; readonly projection: RepoPath }
  | { readonly kind: "config-candidate-unreadable"; readonly file: RepoPath; readonly detail: string };

export type TeamConfigsRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
  readonly trackedPaths: readonly RepoPath[];
  readonly projections: readonly RepoPath[];
};

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

const IN_NODE_MODULES = /(?:^|\/)node_modules\//;

const candidatesOf = (request: { readonly trackedPaths: readonly RepoPath[]; readonly projections: readonly RepoPath[] }): readonly RepoPath[] =>
  request.trackedPaths.filter((file) => SCRIPT_FILE.test(file) && !IN_NODE_MODULES.test(file) && !request.projections.includes(file));

const readCandidate = (request: TeamConfigsRequest & { readonly file: RepoPath }): Result<PlannedRepoFile, TeamConfigRefusal> => {
  const read = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, request.file] }) });
  return read.outcome === "failed"
    ? { outcome: "failed", error: { kind: "config-candidate-unreadable", file: request.file, detail: read.error.detail } }
    : { outcome: "ok", value: { file: request.file, text: read.value } };
};

const importersOf = (request: { readonly candidates: readonly PlannedRepoFile[]; readonly projection: RepoPath }): readonly PlannedRepoFile[] =>
  request.candidates.filter(
    (candidate) =>
      projectionImportingOf({ file: candidate.file, text: candidate.text, versionOneProjection: request.projection }) === "imports",
  );

const teamConfigFor = (request: { readonly candidates: readonly PlannedRepoFile[]; readonly projection: RepoPath }): Result<VersionOneProjection, TeamConfigRefusal> => {
  const { projection } = request;
  const teamConfigs = importersOf(request);
  return teamConfigs.length === 0
    ? { outcome: "failed", error: { kind: "no-file-imports-projection", projection } }
    : { outcome: "ok", value: { projection, teamConfigs } };
};

export const teamConfigsOf = (request: TeamConfigsRequest): Result<readonly VersionOneProjection[], TeamConfigRefusal> => {
  if (request.projections.length === 0) {
    return { outcome: "ok", value: [] };
  }
  const candidates = gatheredOutcomes({ outcomes: candidatesOf(request).map((file) => listedOutcome({ outcome: readCandidate({ ...request, file }) })) });
  if (candidates.outcome === "failed") {
    return candidates;
  }
  return gatheredOutcomes({
    outcomes: request.projections.map((projection) => listedOutcome({ outcome: teamConfigFor({ candidates: candidates.value, projection }) })),
  });
};
