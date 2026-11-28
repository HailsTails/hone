import type {
  RecordsDocument,
  RecordsDocumentRefusal,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { Result } from "../../../domain/result.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { recordsDocumentSchema } from "../records-wire.ts";
import { mapZodIssuesToRecordIssues } from "./record-issues.ts";

export const readEntries = (request: {
  readonly document: RecordsDocument;
}): Result<readonly ReadonlyJsonValue[], RecordsDocumentRefusal> => {
  const parsed = recordsDocumentSchema.safeParse(request.document.document);
  return parsed.success
    ? { outcome: "ok", value: parsed.data.records }
    : {
        outcome: "failed",
        error: {
          kind: "document-refused",
          file: request.document.file,
          issues: mapZodIssuesToRecordIssues({ issues: parsed.error.issues }),
        },
      };
};
