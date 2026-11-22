import type { DirectoryEntry, DirectoryFailure, DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { absolutePathSchema } from "../absolute-path.ts";

type Listing = {
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly root: AbsolutePath;
};

type Within = Listing & { readonly within: readonly string[] };

type Listed = Result<readonly string[], DirectoryFailure>;

const PATH_SEPARATOR = "/";

const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const folderAt = (request: Within): Result<AbsolutePath, DirectoryFailure> => {
  const joined = request.path.join({ segments: [request.root, ...request.within] });
  const folder = absolutePathSchema.safeParse(joined);
  return folder.success
    ? { outcome: "ok", value: folder.data }
    : { outcome: "failed", error: { kind: "directory-unreadable", path: request.root, detail: `${joined} is not an absolute path` } };
};

const joinedLists = (lists: readonly Listed[]): Listed => {
  const failure = lists.find((list) => list.outcome === "failed");
  return failure ?? { outcome: "ok", value: lists.flatMap((list) => (list.outcome === "ok" ? list.value : [])) };
};

const listedEntry = (request: Within & { readonly entry: DirectoryEntry }): Listed =>
  request.entry.kind === "directory"
    ? listedWithin({ ...request, within: [...request.within, request.entry.name] })
    : { outcome: "ok", value: [[...request.within, request.entry.name].join(PATH_SEPARATOR)] };

const listedWithin = (request: Within): Listed => {
  const folder = folderAt(request);
  if (folder.outcome === "failed") {
    return folder;
  }
  const entries = request.directory.list({ path: folder.value });
  return entries.outcome === "failed" ? entries : joinedLists(entries.value.map((entry) => listedEntry({ ...request, entry })));
};

export const filesUnder = (request: Listing): Listed => {
  const listed = listedWithin({ ...request, within: [] });
  return listed.outcome === "failed" ? listed : { outcome: "ok", value: [...listed.value].sort(byCodePoint) };
};
