import { z } from "zod";

import type { ExceptionBaseline } from "../../domain/records/discipline-exceptions/exception-baseline.ts";
import type { PlacedEntry } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionRecord } from "../../domain/records/discipline-exceptions/exception-record.ts";
import type { HeadRecord, HeadRecordsRefusal } from "../../domain/records/upgrade/head-records.ts";
import type { CarriedEntry } from "../../domain/records/upgrade/records-mapping.ts";
import type { Result } from "../../domain/result.ts";
import type { FileExceptionWhyChains } from "../../domain/settings/selection/file-exception-why-chains.ts";
import type { Selection } from "../../domain/settings/selection/selection.ts";
import { parseExceptionEntries } from "./exception-records.ts";

export type HeadRecordsRequest = {
  readonly entries: readonly PlacedEntry[];
  readonly selection: Selection;
  readonly fileExceptionWhyChains: FileExceptionWhyChains;
  readonly baseline: ExceptionBaseline;
};

type JsonEntry = { readonly placed: PlacedEntry; readonly entry: CarriedEntry };

const carriedEntrySchema = z.record(z.string(), z.json());

const headRecordOf = (request: {
  readonly record: ExceptionRecord;
  readonly entry: CarriedEntry;
}): HeadRecord => {
  const { record, entry } = request;
  switch (record.kind) {
    case "file-carve-out":
      return { kind: record.kind, record, entry };
    case "authorised-location":
      return { kind: record.kind, record, entry };
    case "clause-wide-carve-out":
      return { kind: record.kind, record };
  }
};

const jsonEntriesOf = (request: {
  readonly entries: readonly PlacedEntry[];
}): Result<readonly JsonEntry[], HeadRecordsRefusal> => {
  const parsed = request.entries.map((placed) => ({
    placed,
    entry: carriedEntrySchema.safeParse(placed.entry),
  }));
  const refused = parsed.find(({ entry }) => !entry.success);
  return refused === undefined
    ? {
        outcome: "ok",
        value: parsed.flatMap(({ placed, entry }) =>
          entry.success ? [{ placed, entry: entry.data }] : [],
        ),
      }
    : { outcome: "failed", error: { kind: "entry-not-json", place: refused.placed.place } };
};

const headRecordsOfEntry = (
  request: HeadRecordsRequest & { readonly json: JsonEntry },
): readonly HeadRecord[] =>
  parseExceptionEntries({ ...request, entries: [request.json.placed] }).records.map((record) =>
    headRecordOf({ record, entry: request.json.entry }),
  );

export const headRecordsOf = (
  request: HeadRecordsRequest,
): Result<readonly HeadRecord[], HeadRecordsRefusal> => {
  const json = jsonEntriesOf({ entries: request.entries });
  if (json.outcome === "failed") {
    return json;
  }
  const { invalid } = parseExceptionEntries(request);
  return invalid.length > 0
    ? { outcome: "failed", error: { kind: "invalid-records", invalid } }
    : {
        outcome: "ok",
        value: json.value.flatMap((each) => headRecordsOfEntry({ ...request, json: each })),
      };
};
