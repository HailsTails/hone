import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { HoneRecordsFailure } from "../../domain/records/hone-records-failure.ts";
import type {
  RecordsAtBase,
  RecordsReading,
} from "../../domain/records/hone-records/hone-record.ts";
import type { RecordRepointing } from "../../domain/records/hone-records/records-edit.ts";
import {
  movedPathRefusalsOf,
  recordsFollowingRenames,
} from "../../domain/records/hone-records/records-following-renames.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { RenamedSinceBase } from "../../domain/repository/renamed-path.ts";
import type { Result } from "../../domain/result.ts";
import type { GitPort } from "../ports/git-port.ts";
import type { RecordsReader } from "../ports/records/records-reader.ts";
import type { RecordsSource } from "../ports/records/records-source.ts";
import { baseRevisionAvailabilityOf } from "../run/touched-set/touched-set.ts";

const recordsAtBaseOf = (request: {
  readonly source: RecordsSource;
  readonly baseRevision: string | undefined;
}): Result<RecordsAtBase, HoneRecordsFailure> => {
  if (request.baseRevision === undefined) {
    return { outcome: "ok", value: { measured: "no", base: { state: "not-given" } } };
  }
  const atBase = request.source.readAt({ revision: request.baseRevision });
  if (atBase.outcome === "ok") {
    return { outcome: "ok", value: { measured: "yes", documents: atBase.value } };
  }
  return atBase.error.kind === "git-failed"
    ? {
        outcome: "ok",
        value: {
          measured: "no",
          base: baseRevisionAvailabilityOf({
            revision: request.baseRevision,
            failure: atBase.error,
          }),
        },
      }
    : { outcome: "failed", error: { kind: "records-folder", failure: atBase.error } };
};

export const readHoneRecords = (request: {
  readonly source: RecordsSource;
  readonly recordsReader: RecordsReader;
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
  const reading = request.recordsReader.recordsReadingOf({
    documents: working.value,
    catalogue: request.catalogue,
    base: base.value,
  });
  return reading.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-documents", refusals: reading.error } }
    : reading;
};

export const readingFollowingRenames = (request: {
  readonly reading: RecordsReading;
  readonly renamed: RenamedSinceBase;
  readonly moved: readonly RecordRepointing[];
}): RecordsReading => {
  const { reading, renamed } = request;
  if (renamed.measured === "no") {
    return reading.base.measured === "no"
      ? reading
      : { ...reading, base: { measured: "no", base: renamed.base } };
  }
  return {
    ...reading,
    records: recordsFollowingRenames({ records: reading.records, moved: request.moved }),
    refused: [...reading.refused, ...movedPathRefusalsOf({ moved: request.moved })],
  };
};
