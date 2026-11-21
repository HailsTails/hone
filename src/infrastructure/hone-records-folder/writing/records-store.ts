import type { DirectoryPort, FileRemovalPort, FileTextPort } from "../../node/file-system/file-system-port.ts";
import type { PathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import { type RecordsEdit, recordsTextOf } from "../../../domain/records/hone-records/records-edit.ts";

export type RecordsUnwritable = { readonly kind: "file-unwritable"; readonly path: string; readonly detail: string };

export type RecordsStorePorts = {
  readonly fileText: Pick<FileTextPort, "write">;
  readonly removal: FileRemovalPort;
  readonly directory: Pick<DirectoryPort, "create">;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
};

export type RecordsStore = {
  readonly apply: (request: { readonly edit: RecordsEdit }) => Result<void, RecordsUnwritable>;
};

type Step = Result<void, RecordsUnwritable>;

const DONE: Step = { outcome: "ok", value: undefined };

const FOLDER_SEPARATOR = "/";

const absoluteOf = (request: { readonly ports: RecordsStorePorts; readonly file: string }): AbsolutePath =>
  absolutePathSchema.parse(request.ports.path.join({ segments: [request.ports.repoRoot, request.file] }));

const folderOf = (request: { readonly file: RepoPath }): string => request.file.slice(0, request.file.lastIndexOf(FOLDER_SEPARATOR));

const unwritable = (request: { readonly path: string; readonly detail: string }): Step => ({
  outcome: "failed",
  error: { kind: "file-unwritable", path: request.path, detail: request.detail },
});

const writtenDocument = (request: { readonly ports: RecordsStorePorts; readonly document: RecordsDocument }): Step => {
  const made = request.ports.directory.create({ path: absoluteOf({ ports: request.ports, file: folderOf({ file: request.document.file }) }) });
  if (made.outcome === "failed") {
    return unwritable(made.error);
  }
  const written = request.ports.fileText.write({
    path: absoluteOf({ ports: request.ports, file: request.document.file }),
    text: recordsTextOf({ document: request.document.document }),
  });
  return written.outcome === "failed" ? unwritable(written.error) : DONE;
};

const removedFile = (request: { readonly ports: RecordsStorePorts; readonly file: RepoPath }): Step => {
  const removed = request.ports.removal.remove({ path: absoluteOf({ ports: request.ports, file: request.file }) });
  return removed.outcome === "failed" ? unwritable(removed.error) : DONE;
};

const writtenAll = (request: { readonly ports: RecordsStorePorts; readonly documents: readonly RecordsDocument[] }): Step =>
  request.documents.reduce<Step>((sofar, document) => (sofar.outcome === "failed" ? sofar : writtenDocument({ ports: request.ports, document })), DONE);

const removedAll = (request: { readonly ports: RecordsStorePorts; readonly files: readonly RepoPath[] }): Step =>
  request.files.reduce<Step>((sofar, file) => (sofar.outcome === "failed" ? sofar : removedFile({ ports: request.ports, file })), DONE);

export const createRecordsStore = (ports: RecordsStorePorts): RecordsStore => ({
  apply: ({ edit }) => {
    const written = writtenAll({ ports, documents: edit.write });
    return written.outcome === "failed" ? written : removedAll({ ports, files: edit.remove });
  },
});
