import type { z } from "zod";

import type { RecordIssue } from "../../../domain/records/hone-records/hone-record.ts";

export const mapZodIssuesToRecordIssues = (request: {
  readonly issues: readonly z.core.$ZodIssue[];
}): readonly RecordIssue[] =>
  request.issues.map((issue) => ({
    path: issue.path.map((key) => (typeof key === "symbol" ? String(key) : key)),
    message: issue.message,
  }));
