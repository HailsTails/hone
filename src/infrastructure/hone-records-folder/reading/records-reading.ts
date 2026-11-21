import type { z } from "zod";
import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../../domain/result.ts";
import type {
  AuthorisedLocation,
  AuthorisedReach,
  BaseMeasurement,
  CarriedListing,
  CatalogueNote,
  Debt,
  HoneRecord,
  OutsideParty,
  PlacedRecord,
  RecordPlace,
  RecordNote,
  RecordsAtBase,
  RecordsDocument,
  RecordsDocumentRefusal,
  RecordsReading,
  RefusedRecord,
} from "../hone-record.ts";
import { type FiledUnder, recordOf } from "./record-resolution.ts";
import { recordsFileStandingOf } from "../folder-layout/records-layout.ts";
import { recordsDocumentSchema } from "../records-wire.ts";

type PlacedEntry = { readonly place: RecordPlace; readonly filedUnder: FiledUnder; readonly entry: z.core.util.JSONType };

type Judged = { readonly placed: "record"; readonly record: PlacedRecord } | { readonly placed: "refused"; readonly refused: RefusedRecord };

export type Sameness = "same" | "different";

const sameOutsideParty = (request: { readonly left: OutsideParty; readonly right: OutsideParty }): Sameness => {
  const { left, right } = request;
  switch (left.kind) {
    case "package":
      return right.kind === "package" && right.dependency === left.dependency ? "same" : "different";
    case "scheme-module":
      return right.kind === "scheme-module" && right.specifier === left.specifier ? "same" : "different";
    case "runtime":
      return right.kind === "runtime" && right.facility === left.facility ? "same" : "different";
  }
};

const sameReach = (request: { readonly left: AuthorisedReach; readonly right: AuthorisedReach }): Sameness => {
  const { left, right } = request;
  switch (left.reaches) {
    case "whole-symptom":
      return right.reaches === "whole-symptom" ? "same" : "different";
    case "one-check":
      return right.reaches === "one-check" && right.check.name === left.check.name ? "same" : "different";
    case "unknown-check":
      return right.reaches === "unknown-check" && right.check === left.check ? "same" : "different";
  }
};

const sameSymptomSite = (request: { readonly left: Debt | AuthorisedLocation; readonly right: HoneRecord }): Sameness => {
  const { left, right } = request;
  return (right.kind === "debt" || right.kind === "authorised-location") &&
    right.kind === left.kind &&
    right.symptom.name === left.symptom.name &&
    sameReach({ left: left.reach, right: right.reach }) === "same" &&
    right.file === left.file
    ? "same"
    : "different";
};

export const sameRecordIdentity = (request: { readonly left: HoneRecord; readonly right: HoneRecord }): Sameness => {
  const { left, right } = request;
  switch (left.kind) {
    case "debt":
    case "authorised-location":
      return sameSymptomSite({ left, right });
    case "deviation":
      return right.kind === "deviation" && right.recipe.name === left.recipe.name && right.file === left.file ? "same" : "different";
    case "boundary-record":
      return right.kind === "boundary-record" && right.module === left.module && sameOutsideParty({ left: left.outsideParty, right: right.outsideParty }) === "same"
        ? "same"
        : "different";
    case "dependency-record":
      return right.kind === "dependency-record" && right.dependency === left.dependency ? "same" : "different";
  }
};

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

const reachNotesOf = (request: { readonly record: AuthorisedLocation }): readonly CatalogueNote[] => {
  const { record } = request;
  return record.reach.reaches === "unknown-check" ? [{ kind: "unknown-check", symptom: record.symptom, check: record.reach.check }] : [];
};

const owingNotesOf = (request: { readonly record: AuthorisedLocation }): readonly CatalogueNote[] => {
  const { holding } = request.record;
  return holding.held === "stated" && holding.owing.matches === "not-the-catalogue" ? [holding.owing.note] : [];
};

export const catalogueNotesOf = (request: { readonly record: AuthorisedLocation }): readonly CatalogueNote[] => [...reachNotesOf(request), ...owingNotesOf(request)];

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

const carriedOf = (request: { readonly record: HoneRecord }): readonly Omit<CarriedListing, "place">[] => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "boundary-record":
      return record.holding.held === "carried" ? [{ lacks: record.holding.lacks, standing: record.holding.standing }] : [];
    case "deviation":
    case "dependency-record":
      return [];
  }
};

export const carriedListingOf = (request: { readonly records: readonly PlacedRecord[] }): readonly CarriedListing[] =>
  request.records.flatMap(({ place, record }) => carriedOf({ record }).map((carried) => ({ place, ...carried })));

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
