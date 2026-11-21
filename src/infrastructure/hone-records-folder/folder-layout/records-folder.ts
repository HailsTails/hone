import type { DirectoryEntry } from "../../../application/ports/file-system/directory-port.ts";
import type { RecordsFolderPorts } from "../../../application/ports/records/records-source-of.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { parsedJson } from "../../content-files/parsed-json.ts";
import { repoPathSchema } from "../repo-path.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import { RECORDS_FOLDER, recordsFileStandingOf } from "../../../domain/records/hone-records/records-layout.ts";
import type { RecordsSource } from "../../../application/ports/records/records-source.ts";
import type { RecordsFolderFailure } from "../../../domain/records/records-folder-failure.ts";

type FolderRequest = RecordsFolderPorts & { readonly repoRoot: AbsolutePath };

type Listed = Result<readonly RepoPath[], RecordsFolderFailure>;

type Documents = Result<readonly RecordsDocument[], RecordsFolderFailure>;

const RECORDS_FOLDER_PATH = repoPathSchema.parse(RECORDS_FOLDER);

const absoluteOf = (request: FolderRequest & { readonly file: RepoPath }): AbsolutePath =>
  absolutePathSchema.parse(request.path.join({ segments: [request.repoRoot, request.file] }));

const childOf = (request: { readonly folder: RepoPath; readonly entry: DirectoryEntry }): Result<RepoPath, RecordsFolderFailure> => {
  const child = repoPathSchema.safeParse(`${request.folder}/${request.entry.name}`);
  return child.success ? { outcome: "ok", value: child.data } : { outcome: "failed", error: { kind: "not-a-records-name", folder: request.folder, name: request.entry.name } };
};

const codePointOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const inPathOrder = (request: { readonly files: readonly RepoPath[] }): readonly RepoPath[] =>
  request.files.toSorted((left, right) => codePointOrder({ left, right }));

const joined = (request: { readonly listings: readonly Listed[] }): Listed => {
  const failure = request.listings.find((listing) => listing.outcome === "failed");
  return failure ?? { outcome: "ok", value: request.listings.flatMap((listing) => (listing.outcome === "ok" ? listing.value : [])) };
};

const entriesIn = (request: FolderRequest & { readonly folder: RepoPath }): Result<readonly DirectoryEntry[], RecordsFolderFailure> => {
  const listed = request.directory.list({ path: absoluteOf({ ...request, file: request.folder }) });
  return listed.outcome === "failed" ? { outcome: "failed", error: { kind: "records-folder-unreadable", folder: request.folder, detail: listed.error.detail } } : listed;
};

const kindFolderEntryFiles = (request: { readonly folder: RepoPath; readonly entry: DirectoryEntry }): Listed => {
  const child = childOf(request);
  if (child.outcome === "failed") {
    return child;
  }
  return request.entry.kind === "directory" ? { outcome: "failed", error: { kind: "not-a-records-file", file: child.value } } : { outcome: "ok", value: [child.value] };
};

const kindFolderFiles = (request: FolderRequest & { readonly folder: RepoPath }): Listed => {
  const entries = entriesIn(request);
  return entries.outcome === "failed" ? entries : joined({ listings: entries.value.map((entry) => kindFolderEntryFiles({ folder: request.folder, entry })) });
};

const recordsFolderEntryFiles = (request: FolderRequest & { readonly entry: DirectoryEntry }): Listed => {
  const child = childOf({ folder: RECORDS_FOLDER_PATH, entry: request.entry });
  if (child.outcome === "failed") {
    return child;
  }
  return request.entry.kind === "directory" ? kindFolderFiles({ ...request, folder: child.value }) : { outcome: "ok", value: [child.value] };
};

const recordsFolderFiles = (request: FolderRequest): Listed => {
  const entries = entriesIn({ ...request, folder: RECORDS_FOLDER_PATH });
  return entries.outcome === "failed" ? entries : joined({ listings: entries.value.map((entry) => recordsFolderEntryFiles({ ...request, entry })) });
};

const listedDocument = (request: { readonly file: RepoPath; readonly text: string }): Documents => {
  const parsed = parsedJson({ text: request.text });
  return parsed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-file-not-json", file: request.file, detail: parsed.error } }
    : { outcome: "ok", value: [{ file: request.file, document: parsed.value }] };
};

const documentsOf = (request: { readonly files: readonly RepoPath[]; readonly documentsAt: (at: { readonly file: RepoPath }) => Documents }): Documents =>
  request.files.reduce<Documents>((sofar, file) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const documents = request.documentsAt({ file });
    return documents.outcome === "failed" ? documents : { outcome: "ok", value: [...sofar.value, ...documents.value] };
  }, { outcome: "ok", value: [] });

const workingDocumentsAt = (request: FolderRequest & { readonly file: RepoPath }): Documents => {
  if (recordsFileStandingOf({ file: request.file }).standing === "not-a-records-file") {
    return { outcome: "failed", error: { kind: "not-a-records-file", file: request.file } };
  }
  const text = request.fileText.read({ path: absoluteOf(request) });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-file-unreadable", file: request.file, detail: text.error.detail } }
    : listedDocument({ file: request.file, text: text.value });
};

const workingDocuments = (request: FolderRequest): Documents => {
  if (request.fileText.exists({ path: absoluteOf({ ...request, file: RECORDS_FOLDER_PATH }) }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const files = recordsFolderFiles(request);
  return files.outcome === "failed"
    ? files
    : documentsOf({ files: inPathOrder({ files: files.value }), documentsAt: (at) => workingDocumentsAt({ ...request, file: at.file }) });
};

const baseDocumentsAt = (request: FolderRequest & { readonly revision: string; readonly file: RepoPath }): Documents => {
  const text = request.git.textInBase({ repoRoot: request.repoRoot, baseRevision: request.revision, file: request.file });
  if (text.outcome === "failed") {
    return text;
  }
  return text.value.presence === "present-in-base" ? listedDocument({ file: request.file, text: text.value.text }) : { outcome: "ok", value: [] };
};

const baseDocuments = (request: FolderRequest & { readonly revision: string }): Documents => {
  const paths = request.gitTree.pathsAt({ repoRoot: request.repoRoot, revision: request.revision });
  if (paths.outcome === "failed") {
    return paths;
  }
  const files = paths.value.filter((file) => recordsFileStandingOf({ file }).standing !== "not-a-records-file");
  return documentsOf({ files: inPathOrder({ files }), documentsAt: (at) => baseDocumentsAt({ ...request, file: at.file }) });
};

export const createRecordsFolder = (request: FolderRequest): RecordsSource => ({
  read: () => workingDocuments(request),
  readAt: (at) => baseDocuments({ ...request, revision: at.revision }),
});
