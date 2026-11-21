import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import { baseRevisionAvailabilityOf } from "../run/touched-set/touched-set.ts";
import type { Result } from "../../domain/result.ts";
import type { RecordsAtBase, RecordsDocumentRefusal, RecordsReading } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsFolderFailure, RecordsSource } from "../ports/records-source.ts";
import { recordsReadingOf } from "../../infrastructure/hone-records-folder/reading/records-reading.ts";

export type HoneRecordsFailure =
  | { readonly kind: "records-folder"; readonly failure: RecordsFolderFailure }
  | { readonly kind: "records-documents"; readonly refusals: readonly RecordsDocumentRefusal[] };

const recordsAtBaseOf = (request: { readonly source: RecordsSource; readonly baseRevision: string | undefined }): Result<RecordsAtBase, HoneRecordsFailure> => {
  if (request.baseRevision === undefined) {
    return { outcome: "ok", value: { measured: "no", base: { state: "not-given" } } };
  }
  const atBase = request.source.readAt({ revision: request.baseRevision });
  if (atBase.outcome === "ok") {
    return { outcome: "ok", value: { measured: "yes", documents: atBase.value } };
  }
  return atBase.error.kind === "git-failed"
    ? { outcome: "ok", value: { measured: "no", base: baseRevisionAvailabilityOf({ revision: request.baseRevision, failure: atBase.error }) } }
    : { outcome: "failed", error: { kind: "records-folder", failure: atBase.error } };
};

export const readHoneRecords = (request: {
  readonly source: RecordsSource;
  readonly catalogue: SymptomCatalogue;
  readonly baseRevision: string | undefined;
}): Result<RecordsReading, HoneRecordsFailure> => {
  const working = request.source.read();
  if (working.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-folder", failure: working.error } };
  }
  const base = recordsAtBaseOf(request);
  if (base.outcome === "failed") {
    return base;
  }
  const reading = recordsReadingOf({ documents: working.value, catalogue: request.catalogue, base: base.value });
  return reading.outcome === "failed" ? { outcome: "failed", error: { kind: "records-documents", refusals: reading.error } } : reading;
};
