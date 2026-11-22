import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import type { RecordsDocument } from "./hone-record.ts";

export type RecordAddition = { readonly file: RepoPath; readonly entry: ReadonlyJsonValue };

export type RecordsEdit = {
  readonly write: readonly RecordsDocument[];
  readonly remove: readonly RepoPath[];
};

const JSON_INDENT = 2;

export const recordsTextOf = (request: { readonly document: unknown }): string =>
  `${JSON.stringify(request.document, null, JSON_INDENT)}\n`;
