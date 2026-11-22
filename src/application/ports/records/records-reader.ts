import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../../domain/result.ts";
import type { RecordsAtBase, RecordsDocument, RecordsDocumentRefusal, RecordsReading } from "../../../domain/records/hone-records/hone-record.ts";

export type RecordsReader = {
  readonly recordsReadingOf: (request: {
    readonly documents: readonly RecordsDocument[];
    readonly catalogue: SymptomCatalogue;
    readonly base: RecordsAtBase;
  }) => Result<RecordsReading, readonly RecordsDocumentRefusal[]>;
};
