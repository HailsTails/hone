import type { Result } from "../../../domain/result.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import type { RecordsFolderFailure } from "../../../domain/records/records-folder-failure.ts";

export type RecordsSource = {
  readonly read: () => Result<readonly RecordsDocument[], RecordsFolderFailure>;
  readonly readAt: (request: { readonly revision: string }) => Result<readonly RecordsDocument[], RecordsFolderFailure>;
};
