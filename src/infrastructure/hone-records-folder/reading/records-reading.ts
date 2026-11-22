import type { z } from "zod";
import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../../domain/result.ts";
import type {
  BaseMeasurement,
  PlacedRecord,
  RecordPlace,
  RecordNote,
  RecordsAtBase,
  RecordsDocument,
  RecordsDocumentRefusal,
  RecordsReading,
  RefusedRecord,
} from "../../../domain/records/hone-records/hone-record.ts";
import { type FiledUnder, recordOf } from "./record-resolution.ts";
import { recordsFileStandingOf } from "../../../domain/records/hone-records/records-layout.ts";
import { sameRecordIdentity } from "../../../domain/records/hone-records/record-identity.ts";
import { catalogueNotesOf } from "../../../domain/records/hone-records/record-listings.ts";
import { recordsDocumentSchema } from "../records-wire.ts";
import type { RecordsReader } from "../../../application/ports/records/records-reader.ts";

type PlacedEntry = { readonly place: RecordPlace; readonly filedUnder: FiledUnder; readonly entry: z.core.util.JSONType };

type Judged = { readonly placed: "record"; readonly record: PlacedRecord } | { readonly placed: "refused"; readonly refused: RefusedRecord };

const entriesOf = (request: { readonly document: RecordsDocument }): Result<readonly PlacedEntry[], RecordsDocumentRefusal> => {
  const { file } = request.document;
  const standing = recordsFileStandingOf({ file });
  if (standing.standing === "not-a-records-file") {
    return { outcome: "failed", error: { kind: "not-a-records-file", file } };
  }
  const parsed = recordsDocumentSchema.safeParse(request.document.document);
  if (!parsed.success) {
    return { outcome: "failed", error: { kind: "document-refused", file, issues: parsed.error.issues } };
  }
  return { outcome: "ok", value: parsed.data.records.map((entry, index) => ({ place: { file, index }, filedUnder: { kind: standing.kind }, entry })) };
};

const judgedEntry = (request: { readonly placed: PlacedEntry; readonly catalogue: SymptomCatalogue; readonly base: RecordsAtBase }): Judged => {
  const { place, filedUnder, entry } = request.placed;
  const record = recordOf({ catalogue: request.catalogue, base: request.base, file: place.file, entry, filedUnder });
  return record.outcome === "failed"
    ? { placed: "refused", refused: { place, refusals: record.error } }
    : { placed: "record", record: { place, record: record.value } };
};

const duplicateJudged = (request: { readonly judged: Judged; readonly earlier: readonly Judged[] }): Judged => {
  const { judged } = request;
  if (judged.placed === "refused") {
    return judged;
  }
  const first = request.earlier.find(
    (candidate) => candidate.placed === "record" && sameRecordIdentity({ left: candidate.record.record, right: judged.record.record }) === "same",
  );
  return first === undefined || first.placed === "refused"
    ? judged
    : { placed: "refused", refused: { place: judged.record.place, refusals: [{ kind: "duplicate", of: first.record.place }] } };
};

const withoutDuplicates = (request: { readonly judged: readonly Judged[] }): readonly Judged[] =>
  request.judged.map((judged, index) => duplicateJudged({ judged, earlier: request.judged.slice(0, index) }));

const baseMeasurementOf = (request: { readonly base: RecordsAtBase }): BaseMeasurement =>
  request.base.measured === "yes" ? { measured: "yes" } : { measured: "no", base: request.base.base };

const notesOf = (request: { readonly placed: PlacedRecord }): readonly RecordNote[] => {
  const { place, record } = request.placed;
  return record.kind === "authorised-location" ? catalogueNotesOf({ record }).map((note) => ({ place, note })) : [];
};

const readingOf = (request: { readonly judged: readonly Judged[]; readonly base: RecordsAtBase }): RecordsReading => {
  const records = request.judged.flatMap((judged) => (judged.placed === "record" ? [judged.record] : []));
  return {
    records,
    refused: request.judged.flatMap((judged) => (judged.placed === "refused" ? [judged.refused] : [])),
    notes: records.flatMap((placed) => notesOf({ placed })),
    base: baseMeasurementOf(request),
  };
};

export const recordsReadingOf = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly catalogue: SymptomCatalogue;
  readonly base: RecordsAtBase;
}): Result<RecordsReading, readonly RecordsDocumentRefusal[]> => {
  const entries = request.documents.map((document) => entriesOf({ document }));
  const refusals = entries.flatMap((listed) => (listed.outcome === "failed" ? [listed.error] : []));
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  const placed = entries.flatMap((listed) => (listed.outcome === "ok" ? listed.value : []));
  const judged = placed.map((entry) => judgedEntry({ placed: entry, catalogue: request.catalogue, base: request.base }));
  return { outcome: "ok", value: readingOf({ judged: withoutDuplicates({ judged }), base: request.base }) };
};

export const recordsReader: RecordsReader = { recordsReadingOf };
