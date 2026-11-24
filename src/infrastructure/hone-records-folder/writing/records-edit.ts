import { z } from "zod";

import type {
  RecordsEditFailure,
  RecordsEditor,
} from "../../../application/ports/records/records-editor.ts";
import type {
  RecordPlace,
  RecordsDocument,
} from "../../../domain/records/hone-records/hone-record.ts";
import {
  createRecordsDocument,
  type RecordAddition,
  type RecordRepointing,
  type RecordsEdit,
} from "../../../domain/records/hone-records/records-edit.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { readEntries } from "../reading/records-entries.ts";

type Edited = Result<readonly RecordsDocument[], RecordsEditFailure>;

const entriesHeldBy = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly file: RepoPath;
}): Result<readonly ReadonlyJsonValue[], RecordsEditFailure> => {
  const held = request.documents.find((document) => document.file === request.file);
  if (held === undefined) {
    return { outcome: "ok", value: [] };
  }
  const entries = readEntries({ document: held });
  return entries.outcome === "ok"
    ? entries
    : { outcome: "failed", error: { kind: "records-documents", refusals: [entries.error] } };
};

const filesInOrderOf = (request: {
  readonly additions: readonly RecordAddition[];
}): readonly RepoPath[] => [...new Set(request.additions.map((addition) => addition.file))];

export const documentsWithAdded = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly additions: readonly RecordAddition[];
}): Edited =>
  filesInOrderOf(request).reduce<Edited>(
    (sofar, file) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const held = entriesHeldBy({ documents: request.documents, file });
      if (held.outcome === "failed") {
        return held;
      }
      const added = request.additions
        .filter((addition) => addition.file === file)
        .map((addition) => addition.entry);
      return {
        outcome: "ok",
        value: [
          ...sofar.value,
          createRecordsDocument({ file, records: [...held.value, ...added] }),
        ],
      };
    },
    { outcome: "ok", value: [] },
  );

export const placeOfAddition = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly addition: RecordAddition;
}): RecordPlace => {
  const held = entriesHeldBy({ documents: request.documents, file: request.addition.file });
  return { file: request.addition.file, index: held.outcome === "ok" ? held.value.length : 0 };
};

const entryFieldsSchema = z.record(z.string(), z.json());

const repointedEntryOf = (request: {
  readonly entry: ReadonlyJsonValue;
  readonly file: RepoPath | undefined;
}): ReadonlyJsonValue => {
  const fields = entryFieldsSchema.safeParse(request.entry);
  return request.file === undefined || !fields.success
    ? request.entry
    : { ...fields.data, file: request.file };
};

export const documentsWithRepointed = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly repointings: readonly RecordRepointing[];
}): Edited =>
  [...new Set(request.repointings.map(({ place }) => place.file))].reduce<Edited>(
    (sofar, file) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const held = entriesHeldBy({ documents: request.documents, file });
      if (held.outcome === "failed") {
        return held;
      }
      const repointedAt = new Map(
        request.repointings
          .filter(({ place }) => place.file === file)
          .map(({ place, file: repointedTo }) => [place.index, repointedTo]),
      );
      const records = held.value.map((entry, index) =>
        repointedEntryOf({ entry, file: repointedAt.get(index) }),
      );
      return { outcome: "ok", value: [...sofar.value, createRecordsDocument({ file, records })] };
    },
    { outcome: "ok", value: [] },
  );

const placesIn = (request: {
  readonly places: readonly RecordPlace[];
  readonly file: RepoPath;
}): ReadonlySet<number> =>
  new Set(
    request.places.filter((place) => place.file === request.file).map((place) => place.index),
  );

const withoutPlaces = (request: {
  readonly document: RecordsDocument;
  readonly places: readonly RecordPlace[];
}): Result<RecordsEdit, RecordsEditFailure> => {
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
  return {
    outcome: "ok",
    value:
      kept.length === 0
        ? { write: [], remove: [file] }
        : { write: [createRecordsDocument({ file, records: kept })], remove: [] },
  };
};

export const documentsWithRemoved = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly places: readonly RecordPlace[];
}): Result<RecordsEdit, RecordsEditFailure> =>
  request.documents.reduce<Result<RecordsEdit, RecordsEditFailure>>(
    (sofar, document) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const edit = withoutPlaces({ document, places: request.places });
      return edit.outcome === "failed"
        ? edit
        : {
            outcome: "ok",
            value: {
              write: [...sofar.value.write, ...edit.value.write],
              remove: [...sofar.value.remove, ...edit.value.remove],
            },
          };
    },
    { outcome: "ok", value: { write: [], remove: [] } },
  );

export const recordsEditor: RecordsEditor = {
  documentsWithAdded,
  placeOfAddition,
  documentsWithRepointed,
  documentsWithRemoved,
};
