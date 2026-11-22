import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RecordsEdit } from "../../../domain/records/hone-records/records-edit.ts";

export type RecordsUnwritable = { readonly kind: "file-unwritable"; readonly path: string; readonly detail: string };

export type RecordsStore = {
  readonly apply: (request: { readonly edit: RecordsEdit }) => Result<void, RecordsUnwritable>;
};

export type RecordsStoreOf = (request: { readonly repoRoot: AbsolutePath }) => RecordsStore;
