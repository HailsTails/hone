import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { DirectoryEntry, DirectoryPort } from "../node/file-system/file-system-port.ts";
import type { FileTextPort } from "../node/file-system/file-text-port.ts";
import type { FilePresence } from "../../domain/repository/file-presence.ts";
import type { PathPort } from "../node/path-port.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { VersionOneRecordsRoot } from "../../application/upgrade/proof/upgrade-proof.ts";

const SINGLE_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_RECORDS_FOLDER = repoPathSchema.parse("discipline-exceptions");

const RECORDS_FILE_EXTENSION = ".json";

export type RecordsOnDisk = {
  readonly files: readonly RepoPath[];
  readonly folders: readonly RepoPath[];
  readonly root: VersionOneRecordsRoot;
};

export type RecordsOnDiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly directory: Pick<DirectoryPort, "list">;
  readonly path: Pick<PathPort, "join">;
};

type Tree = { readonly files: readonly RepoPath[]; readonly folders: readonly RepoPath[] };

const NOTHING: Tree = { files: [], folders: [] };

const NO_TREE: Result<Tree, LoadFailure> = { outcome: "ok", value: NOTHING };

const unreadable = (request: { readonly path: string; readonly detail: string }): Result<never, LoadFailure> => ({
  outcome: "failed",
  error: { kind: "file-unreadable", path: request.path, detail: request.detail },
});

const absoluteOf = (request: RecordsOnDiskRequest & { readonly shown: RepoPath }): Result<AbsolutePath, LoadFailure> => {
  const joined = request.path.join({ segments: [request.repoRoot, request.shown] });
  const parsed = absolutePathSchema.safeParse(joined);
  return parsed.success ? { outcome: "ok", value: parsed.data } : unreadable({ path: joined, detail: "not an absolute path" });
};

const joinedTrees = (request: { readonly trees: readonly Tree[] }): Tree => ({
  files: request.trees.flatMap(({ files }) => files),
  folders: request.trees.flatMap(({ folders }) => folders),
});

const allOk = (request: { readonly results: readonly Result<Tree, LoadFailure>[] }): Result<readonly Tree[], LoadFailure> => {
  const failed = request.results.find((reading) => reading.outcome === "failed");
  return failed ?? { outcome: "ok", value: request.results.flatMap((reading) => (reading.outcome === "ok" ? [reading.value] : [])) };
};

const entryTreeOf = (request: RecordsOnDiskRequest & { readonly folder: RepoPath; readonly entry: DirectoryEntry }): Result<Tree, LoadFailure> => {
  const shown = repoPathSchema.parse(`${request.folder}/${request.entry.name}`);
  if (request.entry.kind === "directory") {
    return folderTreeOf({ ...request, folder: shown });
  }
  return { outcome: "ok", value: shown.endsWith(RECORDS_FILE_EXTENSION) ? { files: [shown], folders: [] } : NOTHING };
};

const folderTreeOf = (request: RecordsOnDiskRequest & { readonly folder: RepoPath }): Result<Tree, LoadFailure> => {
  const absolute = absoluteOf({ ...request, shown: request.folder });
  if (absolute.outcome === "failed") {
    return absolute;
  }
  const listed = request.directory.list({ path: absolute.value });
  if (listed.outcome === "failed") {
    return unreadable({ path: absolute.value, detail: listed.error.detail });
  }
  const below = allOk({ results: listed.value.map((entry) => entryTreeOf({ ...request, entry })) });
  return below.outcome === "failed" ? below : { outcome: "ok", value: joinedTrees({ trees: [{ files: [], folders: [request.folder] }, ...below.value] }) };
};

const presenceOf = (request: RecordsOnDiskRequest & { readonly shown: RepoPath }): FilePresence => {
  const absolute = absoluteOf(request);
  return absolute.outcome === "ok" ? request.fileText.exists({ path: absolute.value }) : "absent";
};

export const recordsOnDiskOf = (request: RecordsOnDiskRequest): Result<RecordsOnDisk, LoadFailure> => {
  const single = presenceOf({ ...request, shown: SINGLE_RECORDS_FILE }) === "present";
  const split = presenceOf({ ...request, shown: SPLIT_RECORDS_FOLDER }) === "present";
  const tree = split ? folderTreeOf({ ...request, folder: SPLIT_RECORDS_FOLDER }) : NO_TREE;
  if (tree.outcome === "failed") {
    return tree;
  }
  return {
    outcome: "ok",
    value: {
      files: [...(single ? [SINGLE_RECORDS_FILE] : []), ...tree.value.files],
      folders: tree.value.folders,
      root: single ? { kind: "repository" } : { kind: "folder", folder: SPLIT_RECORDS_FOLDER },
    },
  };
};
