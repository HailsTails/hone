import type {
  RecordPlace,
  RecordsDocument,
  RecordsDocumentRefusal,
} from "../../../domain/records/hone-records/hone-record.ts";
import type {
  RecordAddition,
  RecordsEdit,
} from "../../../domain/records/hone-records/records-edit.ts";
import type { Result } from "../../../domain/result.ts";

export type RecordsEditFailure = {
  readonly kind: "records-documents";
  readonly refusals: readonly RecordsDocumentRefusal[];
};

export type RecordsEditor = {
  readonly documentsWithAdded: (request: {
    readonly documents: readonly RecordsDocument[];
    readonly additions: readonly RecordAddition[];
  }) => Result<readonly RecordsDocument[], RecordsEditFailure>;
  readonly placeOfAddition: (request: {
    readonly documents: readonly RecordsDocument[];
    readonly addition: RecordAddition;
  }) => RecordPlace;
  readonly documentsWithRemoved: (request: {
    readonly documents: readonly RecordsDocument[];
    readonly places: readonly RecordPlace[];
  }) => Result<RecordsEdit, RecordsEditFailure>;
};
