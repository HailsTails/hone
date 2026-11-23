import type { z } from "zod";

import type { RecordsReader } from "../../../application/ports/records/records-reader.ts";
import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
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
import {
  identityPlaceOf,
  sameRecordIdentity,
} from "../../../domain/records/hone-records/record-identity.ts";
import { catalogueNotesOf } from "../../../domain/records/hone-records/record-listings.ts";
import { recordsFileStandingOf } from "../../../domain/records/hone-records/records-layout.ts";
import type { Result } from "../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { RuleSetName } from "../../../domain/rule-set/identifier-types.ts";
import { recordsDocumentSchema } from "../records-wire.ts";
import { type FiledUnder, recordOf } from "./record-resolution.ts";

type PlacedEntry = {
  readonly place: RecordPlace;
  readonly filedUnder: FiledUnder;
  readonly entry: z.core.util.JSONType;
};

type Judged =
  | { readonly placed: "record"; readonly record: PlacedRecord }
  | { readonly placed: "refused"; readonly refused: RefusedRecord };

const ruleSetsReadOf = (request: {
  readonly catalogue: SymptomCatalogue;
}): ReadonlySet<RuleSetName> =>
  new Set(
    request.catalogue.symptoms.flatMap(({ ruleSet }) =>
      ruleSet === TOOL_RULE_SET ? [] : [ruleSet.name],
    ),
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
      error: { kind: "document-refused", file, issues: parsed.error.issues },
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
  readonly catalogue: SymptomCatalogue;
  readonly base: RecordsAtBase;
}): Judged => {
  const { place, filedUnder, entry } = request.placed;
  const record = recordOf({
    catalogue: request.catalogue,
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

const baseMeasurementOf = (request: { readonly base: RecordsAtBase }): BaseMeasurement =>
  request.base.measured === "yes"
    ? { measured: "yes" }
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

export const recordsReadingOf = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly catalogue: SymptomCatalogue;
  readonly base: RecordsAtBase;
}): Result<RecordsReading, readonly RecordsDocumentRefusal[]> => {
  const ruleSetsRead = ruleSetsReadOf(request);
  const entries = request.documents.map((document) => entriesOf({ document, ruleSetsRead }));
  const refusals = entries.flatMap((listed) => (listed.outcome === "failed" ? [listed.error] : []));
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  const placed = entries.flatMap((listed) => (listed.outcome === "ok" ? listed.value : []));
  const judged = placed.map((entry) =>
    judgedEntry({ placed: entry, catalogue: request.catalogue, base: request.base }),
  );
  return {
    outcome: "ok",
    value: readingOf({ judged: withoutDuplicates({ judged }), base: request.base }),
  };
};

export const recordsReader: RecordsReader = { recordsReadingOf };
