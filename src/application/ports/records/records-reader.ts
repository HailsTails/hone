import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  RecordsAtBase,
  RecordsDocument,
  RecordsDocumentRefusal,
  RecordsReading,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { Result } from "../../../domain/result.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";

export type RecordsReader = {
  readonly recordsReadingOf: (request: {
    readonly documents: readonly RecordsDocument[];
    readonly catalogue: SymptomCatalogue;
    readonly base: RecordsAtBase;
  }) => Result<RecordsReading, readonly RecordsDocumentRefusal[]>;
  readonly readEntries: (request: {
    readonly document: RecordsDocument;
  }) => Result<readonly ReadonlyJsonValue[], RecordsDocumentRefusal>;
};
