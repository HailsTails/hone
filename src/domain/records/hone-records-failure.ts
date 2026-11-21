import type { RecordsFolderFailure } from "./records-folder-failure.ts";
import type { RecordsDocumentRefusal } from "../../infrastructure/hone-records-folder/hone-record.ts";

export type HoneRecordsFailure =
  | { readonly kind: "records-folder"; readonly failure: RecordsFolderFailure }
  | { readonly kind: "records-documents"; readonly refusals: readonly RecordsDocumentRefusal[] };
