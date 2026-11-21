import type { z } from "zod";
import { codePointOrder } from "../../domain/records/code-point-order.ts";
import { type NamedFolderKind, namedRecordsFileOf } from "./folder-layout/records-layout.ts";
import { type carriedAuthorisedLocationWireSchema, type debtWireSchema, RECORDS_VERSION } from "./records-wire.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import { checkAddressOf } from "../../domain/language-layer/check-address.ts";
import type { Check } from "../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressText } from "../discipline-exceptions-folder/clause-address.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import type { RepoPath } from "./repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { DeepReadonly } from "../engines/protocol/runner-module/type-equality.ts";
import type { ExceptionRecord } from "../../domain/records/discipline-exceptions/exception-record.ts";
import { checksOfClause } from "../../application/upgrade/mapping/clause-checks.ts";
import type { UnansweredCredit, UpgradeRefusal } from "../../application/upgrade/mapping/upgrade-refusal.ts";

export type CarriedEntry = { readonly [key: string]: ReadonlyJsonValue };

export type CarveOutAnswer = { readonly credit: "findings"; readonly checks: readonly Check[] } | { readonly credit: UnansweredCredit };

export type LocationAnswer = { readonly reach: "answered-checks"; readonly checks: readonly Check[] } | { readonly reach: "whole-clause" };

type RecordOf<Kind extends ExceptionRecord["kind"]> = Extract<ExceptionRecord, { readonly kind: Kind }>;

export type RecordInput =
  | {
      readonly kind: "file-carve-out";
      readonly record: RecordOf<"file-carve-out">;
      readonly entry: CarriedEntry;
      readonly answer: CarveOutAnswer;
    }
  | {
      readonly kind: "authorised-location";
      readonly record: Pick<RecordOf<"authorised-location">, "clause" | "file">;
      readonly entry: CarriedEntry;
      readonly answer: LocationAnswer;
    }
  | { readonly kind: "clause-wide-carve-out"; readonly record: RecordOf<"clause-wide-carve-out"> };

export type RecordsMappingRequest = { readonly inputs: readonly RecordInput[]; readonly catalogues: readonly RuleSetCatalogue[] };

export type WrittenRecord = DeepReadonly<z.input<typeof debtWireSchema> | z.input<typeof carriedAuthorisedLocationWireSchema>>;

export type MappedRecordsDocument = { readonly file: RepoPath; readonly version: typeof RECORDS_VERSION; readonly records: readonly WrittenRecord[] };

export type MappedRecords = { readonly documents: readonly MappedRecordsDocument[] };

type PlacedRecord = { readonly file: RepoPath; readonly record: WrittenRecord };

type InputOutcome = { readonly placed: readonly PlacedRecord[]; readonly refusals: readonly UpgradeRefusal[] };

const refusedWith = (request: { readonly refusal: UpgradeRefusal }): InputOutcome => ({ placed: [], refusals: [request.refusal] });

const withoutRepeats = (request: { readonly checks: readonly Check[] }): readonly Check[] =>
  request.checks.filter(
    (check, index) => request.checks.findIndex((earlier) => checkAddressOf({ check: earlier }) === checkAddressOf({ check })) === index,
  );

const placedAt = (request: {
  readonly kind: NamedFolderKind;
  readonly check: Check;
  readonly record: WrittenRecord;
}): Result<PlacedRecord, UpgradeRefusal> => {
  const file = namedRecordsFileOf({ kind: request.kind, name: request.check.symptom.name });
  return file.outcome === "ok"
    ? { outcome: "ok", value: { file: file.value, record: request.record } }
    : { outcome: "failed", error: { kind: "records-name-refused", name: request.check.symptom.name } };
};

const outcomeOfPlacements = (request: { readonly placements: readonly Result<PlacedRecord, UpgradeRefusal>[] }): InputOutcome => ({
  placed: request.placements.flatMap((placement) => (placement.outcome === "ok" ? [placement.value] : [])),
  refusals: request.placements.flatMap((placement) => (placement.outcome === "failed" ? [placement.error] : [])),
});

const noteOf = (request: { readonly reason: string | undefined }): { readonly note?: string } =>
  request.reason === undefined ? {} : { note: request.reason };

const holdingOf = (request: { readonly record: RecordOf<"file-carve-out"> }): "carried" | "stated" =>
  request.record.whyChain !== undefined || request.record.provenance !== undefined ? "carried" : "stated";

const debtRecordOf = (request: { readonly record: RecordOf<"file-carve-out">; readonly check: Check; readonly entry: CarriedEntry }): WrittenRecord => {
  const answers = checkAddressOf({ check: request.check });
  return holdingOf({ record: request.record }) === "carried"
    ? { answers, file: request.record.file, carried: request.entry }
    : { answers, file: request.record.file, ...noteOf({ reason: request.record.reason }) };
};

const carveOutOutcome = (request: { readonly input: Extract<RecordInput, { readonly kind: "file-carve-out" }> }): InputOutcome => {
  const { record, answer, entry } = request.input;
  if (answer.credit !== "findings") {
    return refusedWith({
      refusal: { kind: "record-answers-nothing", clause: clauseAddressText({ address: record.clause }), file: record.file, credited: answer.credit },
    });
  }
  return outcomeOfPlacements({
    placements: withoutRepeats({ checks: answer.checks }).map((check) =>
      placedAt({ kind: "debt", check, record: debtRecordOf({ record, check, entry }) }),
    ),
  });
};

const checksAnsweredBy = (request: { readonly answer: LocationAnswer; readonly clauseChecks: readonly Check[] }): readonly Check[] =>
  request.answer.reach === "answered-checks" ? withoutRepeats({ checks: request.answer.checks }) : request.clauseChecks;

const authorisedLocationOutcome = (request: {
  readonly input: Extract<RecordInput, { readonly kind: "authorised-location" }>;
  readonly catalogues: readonly RuleSetCatalogue[];
}): InputOutcome => {
  const { record, entry, answer } = request.input;
  const clauseChecks = checksOfClause({ catalogues: request.catalogues, clause: record.clause });
  if (clauseChecks.length === 0) {
    return refusedWith({ refusal: { kind: "clause-without-check", clause: clauseAddressText({ address: record.clause }) } });
  }
  return outcomeOfPlacements({
    placements: checksAnsweredBy({ answer, clauseChecks }).map((check) =>
      placedAt({
        kind: "authorised-locations",
        check,
        record: { answers: checkAddressOf({ check }), file: record.file, carried: entry },
      }),
    ),
  });
};

const outcomeOf = (request: { readonly input: RecordInput; readonly catalogues: readonly RuleSetCatalogue[] }): InputOutcome => {
  const { input } = request;
  switch (input.kind) {
    case "file-carve-out":
      return carveOutOutcome({ input });
    case "authorised-location":
      return authorisedLocationOutcome({ input, catalogues: request.catalogues });
    case "clause-wide-carve-out":
      return refusedWith({ refusal: { kind: "clause-wide-carve-out", clause: clauseAddressText({ address: input.record.clause }) } });
  }
};

const documentsOf = (request: { readonly placed: readonly PlacedRecord[] }): readonly MappedRecordsDocument[] =>
  [...new Set(request.placed.map(({ file }) => file))]
    .toSorted((left, right) => codePointOrder({ left, right }))
    .map((file) => ({
      file,
      version: RECORDS_VERSION,
      records: request.placed.filter((placed) => placed.file === file).map(({ record }) => record),
    }));

export const mappedRecords = (request: RecordsMappingRequest): Result<MappedRecords, readonly UpgradeRefusal[]> => {
  const outcomes = request.inputs.map((input) => outcomeOf({ input, catalogues: request.catalogues }));
  const refusals = outcomes.flatMap((outcome) => outcome.refusals);
  return refusals.length > 0
    ? { outcome: "failed", error: refusals }
    : { outcome: "ok", value: { documents: documentsOf({ placed: outcomes.flatMap((outcome) => outcome.placed) }) } };
};
