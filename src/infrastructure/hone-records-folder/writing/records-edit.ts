import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import type { RecordAddition, RecordsEdit } from "../../../domain/records/hone-records/records-edit.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RecordPlace, RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import type { HoneRecordsFailure } from "../../../domain/records/hone-records-failure.ts";
import { recordsDocumentSchema } from "../records-wire.ts";
import { RECORDS_VERSION } from "../../../domain/records/hone-records/records-layout.ts";

export type RecordsEditFailure = Extract<HoneRecordsFailure, { readonly kind: "records-documents" }>;

type Edited = Result<readonly RecordsDocument[], RecordsEditFailure>;

const entriesHeldBy = (request: { readonly documents: readonly RecordsDocument[]; readonly file: RepoPath }): Result<readonly ReadonlyJsonValue[], RecordsEditFailure> => {
  const held = request.documents.find((document) => document.file === request.file);
  if (held === undefined) {
    return { outcome: "ok", value: [] };
  }
  const parsed = recordsDocumentSchema.safeParse(held.document);
  return parsed.success ? { outcome: "ok", value: parsed.data.records } : { outcome: "failed", error: { kind: "records-documents", refusals: [{ kind: "document-refused", file: request.file, issues: parsed.error.issues }] } };
};

const documentOf = (request: { readonly file: RepoPath; readonly records: readonly ReadonlyJsonValue[] }): RecordsDocument => ({
  file: request.file,
  document: { version: RECORDS_VERSION, records: request.records },
});

const filesInOrderOf = (request: { readonly additions: readonly RecordAddition[] }): readonly RepoPath[] => [...new Set(request.additions.map((addition) => addition.file))];

export const documentsWithAdded = (request: { readonly documents: readonly RecordsDocument[]; readonly additions: readonly RecordAddition[] }): Edited =>
  filesInOrderOf(request).reduce<Edited>((sofar, file) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const held = entriesHeldBy({ documents: request.documents, file });
    if (held.outcome === "failed") {
      return held;
    }
    const added = request.additions.filter((addition) => addition.file === file).map((addition) => addition.entry);
    return { outcome: "ok", value: [...sofar.value, documentOf({ file, records: [...held.value, ...added] })] };
  }, { outcome: "ok", value: [] });

export const placeOfAddition = (request: { readonly documents: readonly RecordsDocument[]; readonly addition: RecordAddition }): RecordPlace => {
  const held = entriesHeldBy({ documents: request.documents, file: request.addition.file });
  return { file: request.addition.file, index: held.outcome === "ok" ? held.value.length : 0 };
};

const placesIn = (request: { readonly places: readonly RecordPlace[]; readonly file: RepoPath }): ReadonlySet<number> =>
  new Set(request.places.filter((place) => place.file === request.file).map((place) => place.index));

const withoutPlaces = (request: { readonly document: RecordsDocument; readonly places: readonly RecordPlace[] }): Result<RecordsEdit, RecordsEditFailure> => {
  const { file } = request.document;
  const removed = placesIn({ places: request.places, file });
  if (removed.size === 0) {
    return { outcome: "ok", value: { write: [], remove: [] } };
  }
  const held = entriesHeldBy({ documents: [request.document], file });
  if (held.outcome === "failed") {
    return held;
  }
  const kept = held.value.filter((_entry, index) => !removed.has(index));
  return { outcome: "ok", value: kept.length === 0 ? { write: [], remove: [file] } : { write: [documentOf({ file, records: kept })], remove: [] } };
};

export const documentsWithRemoved = (request: { readonly documents: readonly RecordsDocument[]; readonly places: readonly RecordPlace[] }): Result<RecordsEdit, RecordsEditFailure> =>
  request.documents.reduce<Result<RecordsEdit, RecordsEditFailure>>(
    (sofar, document) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const edit = withoutPlaces({ document, places: request.places });
      return edit.outcome === "failed"
        ? edit
        : { outcome: "ok", value: { write: [...sofar.value.write, ...edit.value.write], remove: [...sofar.value.remove, ...edit.value.remove] } };
    },
    { outcome: "ok", value: { write: [], remove: [] } },
  );
