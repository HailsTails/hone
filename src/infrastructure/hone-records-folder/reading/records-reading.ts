import type { RecordsReader } from "../../../application/ports/records/records-reader.ts";
import type { Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import type {
  BaseMeasurement,
  HoneRecord,
  PlacedRecord,
  RecordPlace,
  RecordNote,
  RecordsAtBase,
  RecordsDocument,
  RecordsDocumentRefusal,
  RecordsReading,
  RefusedRecord,
} from "../../../domain/records/hone-records/hone-record.ts";
import {
  identityPlaceOf,
  sameRecordIdentity,
} from "../../../domain/records/hone-records/record-identity.ts";
import { catalogueNotesOf } from "../../../domain/records/hone-records/record-listings.ts";
import { recordsFileStandingOf } from "../../../domain/records/hone-records/records-layout.ts";
import type { Result } from "../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { RuleSetName } from "../../../domain/rule-set/identifier-types.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import { recordsDocumentSchema } from "../records-wire.ts";
import { mapZodIssuesToRecordIssues } from "./record-issues.ts";
import { type FiledUnder, type RecordLookups, recordOf } from "./record-resolution.ts";
import { readEntries } from "./records-entries.ts";

type PlacedEntry = {
  readonly place: RecordPlace;
  readonly filedUnder: FiledUnder;
  readonly entry: ReadonlyJsonValue;
};

type Judged =
  | { readonly placed: "record"; readonly record: PlacedRecord }
  | { readonly placed: "refused"; readonly refused: RefusedRecord };

const ruleSetsReadOf = (request: {
  readonly symptoms: readonly Symptom[];
}): ReadonlySet<RuleSetName> =>
  new Set(
    request.symptoms.flatMap(({ ruleSet }) => (ruleSet === TOOL_RULE_SET ? [] : [ruleSet.name])),
  );

const entriesOf = (request: {
  readonly document: RecordsDocument;
  readonly ruleSetsRead: ReadonlySet<RuleSetName>;
}): Result<readonly PlacedEntry[], RecordsDocumentRefusal> => {
  const { file } = request.document;
  const standing = recordsFileStandingOf({ file });
  if (standing.standing === "not-a-records-file") {
    return { outcome: "failed", error: { kind: "not-a-records-file", file } };
  }
  if (
    standing.standing === "named" &&
    standing.ruleSet !== TOOL_RULE_SET &&
    !request.ruleSetsRead.has(standing.ruleSet.name)
  ) {
    return {
      outcome: "failed",
      error: { kind: "unknown-rule-set", file, ruleSet: standing.ruleSet.name },
    };
  }
  const parsed = recordsDocumentSchema.safeParse(request.document.document);
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: {
        kind: "document-refused",
        file,
        issues: mapZodIssuesToRecordIssues({ issues: parsed.error.issues }),
      },
    };
  }
  return {
    outcome: "ok",
    value: parsed.data.records.map((entry, index) => ({
      place: { file, index },
      filedUnder:
        standing.standing === "named"
          ? { kind: standing.kind, ruleSet: standing.ruleSet }
          : { kind: standing.kind },
      entry,
    })),
  };
};

const judgedEntry = (request: {
  readonly placed: PlacedEntry;
  readonly lookups: RecordLookups;
  readonly base: RecordsAtBase;
}): Judged => {
  const { place, filedUnder, entry } = request.placed;
  const record = recordOf({
    ...request.lookups,
    base: request.base,
    file: place.file,
    entry,
    filedUnder,
  });
  return record.outcome === "failed"
    ? { placed: "refused", refused: { place, refusals: record.error } }
    : { placed: "record", record: { place, record: record.value } };
};

const duplicateJudged = (request: {
  readonly judged: Judged;
  readonly earlier: readonly Judged[];
}): Judged => {
  const { judged } = request;
  if (judged.placed === "refused") {
    return judged;
  }
  const first = request.earlier.find(
    (candidate) =>
      candidate.placed === "record" &&
      sameRecordIdentity({ left: candidate.record.record, right: judged.record.record }) === "same",
  );
  return first === undefined || first.placed === "refused"
    ? judged
    : {
        placed: "refused",
        refused: {
          place: judged.record.place,
          refusals: [{ kind: "duplicate", of: first.record.place }],
        },
      };
};

type Positioned = { readonly judged: Judged; readonly position: number };

const recordsByIdentityPlace = (request: {
  readonly judged: readonly Judged[];
}): ReadonlyMap<string, readonly Positioned[]> =>
  Map.groupBy(
    request.judged.flatMap((judged, position) =>
      judged.placed === "record"
        ? [{ judged, position, place: identityPlaceOf({ record: judged.record.record }) }]
        : [],
    ),
    ({ place }) => place,
  );

const earlierAtPlace = (request: {
  readonly byPlace: ReadonlyMap<string, readonly Positioned[]>;
  readonly judged: Judged;
  readonly position: number;
}): readonly Judged[] =>
  request.judged.placed === "refused"
    ? []
    : (request.byPlace.get(identityPlaceOf({ record: request.judged.record.record })) ?? [])
        .filter(({ position }) => position < request.position)
        .map(({ judged }) => judged);

const withoutDuplicates = (request: { readonly judged: readonly Judged[] }): readonly Judged[] => {
  const byPlace = recordsByIdentityPlace(request);
  return request.judged.map((judged, position) =>
    duplicateJudged({ judged, earlier: earlierAtPlace({ byPlace, judged, position }) }),
  );
};

const recordsHeldAtBase = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly lookups: RecordLookups;
  readonly base: RecordsAtBase;
}): readonly HoneRecord[] => {
  const ruleSetsRead = ruleSetsReadOf(request.lookups);
  return request.documents.flatMap((document) => {
    const listed = entriesOf({ document, ruleSetsRead });
    return listed.outcome === "failed"
      ? []
      : listed.value.flatMap((placed) => {
          const judged = judgedEntry({ placed, lookups: request.lookups, base: request.base });
          return judged.placed === "record" ? [judged.record.record] : [];
        });
  });
};

const baseMeasurementOf = (request: {
  readonly base: RecordsAtBase;
  readonly lookups: RecordLookups;
}): BaseMeasurement =>
  request.base.measured === "yes"
    ? {
        measured: "yes",
        held: recordsHeldAtBase({
          documents: request.base.documents,
          lookups: request.lookups,
          base: request.base,
        }),
      }
    : { measured: "no", base: request.base.base };

const notesOf = (request: { readonly placed: PlacedRecord }): readonly RecordNote[] => {
  const { place, record } = request.placed;
  return record.kind === "authorised-location"
    ? catalogueNotesOf({ record }).map((note) => ({ place, note }))
    : [];
};

const readingOf = (request: {
  readonly judged: readonly Judged[];
  readonly base: RecordsAtBase;
  readonly lookups: RecordLookups;
}): RecordsReading => {
  const records = request.judged.flatMap((judged) =>
    judged.placed === "record" ? [judged.record] : [],
  );
  return {
    records,
    refused: request.judged.flatMap((judged) =>
      judged.placed === "refused" ? [judged.refused] : [],
    ),
    notes: records.flatMap((placed) => notesOf({ placed })),
    base: baseMeasurementOf(request),
  };
};

export const readRecords = (
  request: RecordLookups & {
    readonly documents: readonly RecordsDocument[];
    readonly base: RecordsAtBase;
  },
): Result<RecordsReading, readonly RecordsDocumentRefusal[]> => {
  const { documents, base, ...lookups } = request;
  const ruleSetsRead = ruleSetsReadOf(lookups);
  const entries = documents.map((document) => entriesOf({ document, ruleSetsRead }));
  const refusals = entries.flatMap((listed) => (listed.outcome === "failed" ? [listed.error] : []));
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  const placed = entries.flatMap((listed) => (listed.outcome === "ok" ? listed.value : []));
  const judged = placed.map((entry) => judgedEntry({ placed: entry, lookups, base }));
  return {
    outcome: "ok",
    value: readingOf({
      judged: withoutDuplicates({ judged }),
      base,
      lookups,
    }),
  };
};

export const recordsReader: RecordsReader = {
  recordsReadingOf: ({ documents, catalogue, base }) =>
    readRecords({
      documents,
      base,
      symptoms: catalogue.symptoms,
      checks: catalogue.checks,
      recipes: catalogue.recipes,
      cases: catalogue.cases,
      namedBans: catalogue.namedBans,
    }),
  readEntries,
};
