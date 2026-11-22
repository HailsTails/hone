import type { RepoPath } from "../../repository/repo-path-types.ts";
import { isRepoPath } from "../../repository/repo-path.ts";
import type { Result } from "../../result.ts";
import type { RecordsFolderKind } from "./hone-record.ts";
import { isCatalogueName } from "../../language-layer/catalogue-name.ts";

export const RECORDS_VERSION = 2;

export const RECORDS_FOLDER = "hone-records";

export const RECORDS_FILE_EXTENSION = ".json";

export type NamedFolderKind = Extract<RecordsFolderKind, "authorised-locations" | "debt" | "deviations">;

export type SingleFileKind = Extract<RecordsFolderKind, "boundary-records" | "dependency-records">;

export const NAMED_FOLDER_KINDS: readonly NamedFolderKind[] = ["authorised-locations", "debt", "deviations"];

export const SINGLE_FILE_KINDS: readonly SingleFileKind[] = ["boundary-records", "dependency-records"];

export type RecordsFileStanding =
  | { readonly standing: "named"; readonly kind: NamedFolderKind; readonly name: string }
  | { readonly standing: "single"; readonly kind: SingleFileKind }
  | { readonly standing: "not-a-records-file" };

export type NotARecordsName = { readonly kind: "not-a-records-name"; readonly name: string };

const NOT_A_RECORDS_FILE: RecordsFileStanding = { standing: "not-a-records-file" };

const namedFileOf = (request: { readonly folder: string; readonly name: string }): RecordsFileStanding => {
  const kind = NAMED_FOLDER_KINDS.find((candidate) => candidate === request.folder);
  return kind === undefined || !request.name.endsWith(RECORDS_FILE_EXTENSION) || request.name.length === RECORDS_FILE_EXTENSION.length
    ? NOT_A_RECORDS_FILE
    : { standing: "named", kind, name: request.name.slice(0, -RECORDS_FILE_EXTENSION.length) };
};

const singleFileOf = (request: { readonly name: string }): RecordsFileStanding => {
  const kind = SINGLE_FILE_KINDS.find((candidate) => `${candidate}${RECORDS_FILE_EXTENSION}` === request.name);
  return kind === undefined ? NOT_A_RECORDS_FILE : { standing: "single", kind };
};

export const recordsFileStandingOf = (request: { readonly file: RepoPath }): RecordsFileStanding => {
  const [root, first, second, ...rest] = request.file.split("/");
  if (root !== RECORDS_FOLDER || first === undefined || rest.length > 0) {
    return NOT_A_RECORDS_FILE;
  }
  return second === undefined ? singleFileOf({ name: first }) : namedFileOf({ folder: first, name: second });
};

export const namedRecordsFileOf = (request: { readonly kind: NamedFolderKind; readonly name: string }): Result<RepoPath, NotARecordsName> => {
  const file = `${RECORDS_FOLDER}/${request.kind}/${request.name}${RECORDS_FILE_EXTENSION}`;
  return isCatalogueName(request.name) && isRepoPath(file)
    ? { outcome: "ok", value: file }
    : { outcome: "failed", error: { kind: "not-a-records-name", name: request.name } };
};
