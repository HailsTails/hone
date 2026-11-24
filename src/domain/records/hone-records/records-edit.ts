import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import type { RecordPlace, RecordsDocument } from "./hone-record.ts";
import { RECORDS_VERSION } from "./records-layout.ts";

export type RecordAddition = { readonly file: RepoPath; readonly entry: ReadonlyJsonValue };

export type RecordRepointing = { readonly place: RecordPlace; readonly file: RepoPath };

export type RecordsEdit = {
  readonly write: readonly RecordsDocument[];
  readonly remove: readonly RepoPath[];
};

const JSON_INDENT = 2;

export const createRecordsDocument = (request: {
  readonly file: RepoPath;
  readonly records: readonly ReadonlyJsonValue[];
}): RecordsDocument => ({
  file: request.file,
  document: { version: RECORDS_VERSION, records: request.records },
});

export const recordsTextOf = (request: { readonly document: unknown }): string =>
  `${JSON.stringify(request.document, null, JSON_INDENT)}\n`;
