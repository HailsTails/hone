import type {
  DirectoryEntry,
  DirectoryPort,
} from "../../src/application/ports/file-system/directory-port.ts";
import type { DirectoryTreePort } from "../../src/application/ports/file-system/directory-tree-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import { gatheredOutcomes } from "../../src/domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import {
  listChecksProjectionOutputs,
  PROJECTION_KINDS,
} from "../../src/infrastructure/engines/eslint/runner/projection/projection-kinds.ts";

export type SourceTree = {
  readonly repoRoot: AbsolutePath;
  readonly directory: Pick<DirectoryPort, "list">;
  readonly directoryTree: Pick<DirectoryTreePort, "list">;
  readonly path: Pick<PathPort, "join" | "resolve">;
};

const SOURCE_FILE = /\.(?:[cm]?[jt]s|tsx)$/;

const UNREAD_PATH = /(?:^|\/)(?:\.[^/]*|node_modules)(?:\/|$)|^artefacts(?:\/|$)/;

const PROJECTED_FILES: readonly string[] = PROJECTION_KINDS.flatMap(listChecksProjectionOutputs);

const listFolderFiles = (
  request: SourceTree & { readonly folder: string },
): Result<readonly string[], string> => {
  const folder = request.path.resolve({
    path: request.path.join({ segments: [request.repoRoot, request.folder] }),
  });
  if (folder.outcome === "failed") {
    return { outcome: "failed", error: `${folder.error.path}: ${folder.error.kind}` };
  }
  const entries = request.directoryTree.list({ path: folder.value });
  return entries.outcome === "failed"
    ? { outcome: "failed", error: `${entries.error.path}: ${entries.error.detail}` }
    : {
        outcome: "ok",
        value: entries.value.flatMap(({ kind, path }) =>
          kind === "file" ? [`${request.folder}/${path}`] : [],
        ),
      };
};

const listEntryFiles = (
  request: SourceTree & { readonly entry: DirectoryEntry },
): Result<readonly string[], string> =>
  request.entry.kind === "file"
    ? { outcome: "ok", value: [request.entry.name] }
    : listFolderFiles({ ...request, folder: request.entry.name });

export const listSourceFiles = (request: SourceTree): Result<readonly string[], string> => {
  const root = request.directory.list({ path: request.repoRoot });
  if (root.outcome === "failed") {
    return { outcome: "failed", error: `${root.error.path}: ${root.error.detail}` };
  }
  const files = gatheredOutcomes({
    outcomes: root.value
      .filter(({ name }) => !UNREAD_PATH.test(name))
      .map((entry) => listEntryFiles({ ...request, entry })),
  });
  return files.outcome === "failed"
    ? files
    : {
        outcome: "ok",
        value: files.value.filter(
          (file) =>
            SOURCE_FILE.test(file) && !UNREAD_PATH.test(file) && !PROJECTED_FILES.includes(file),
        ),
      };
};
