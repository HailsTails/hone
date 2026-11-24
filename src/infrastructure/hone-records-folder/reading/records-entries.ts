import type { RecordsReader } from "../../../application/ports/records/records-reader.ts";
import { recordsDocumentSchema } from "../records-wire.ts";
import { mapZodIssuesToRecordIssues } from "./record-issues.ts";

export const readEntries: RecordsReader["readEntries"] = (request) => {
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
