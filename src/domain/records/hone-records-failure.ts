import type { RecordsFolderFailure } from "./records-folder-failure.ts";
import type { RecordsDocumentRefusal } from "./hone-records/hone-record.ts";

export type HoneRecordsFailure =
  | { readonly kind: "records-folder"; readonly failure: RecordsFolderFailure }
  | { readonly kind: "records-documents"; readonly refusals: readonly RecordsDocumentRefusal[] };
