import { checkAddressOf } from "../../language-layer/check-address.ts";
import { checksOfClause } from "../../language-layer/clause-checks.ts";
import type { Check } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { Result } from "../../result.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../rule-set/clause-address.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import { codePointOrder } from "../code-point-order.ts";
import type { ExceptionRecord } from "../discipline-exceptions/exception-record.ts";
import {
  type NamedFolderKind,
  RECORDS_VERSION,
  namedRecordsFileOf,
} from "../hone-records/records-layout.ts";
import type { UnansweredCredit, UpgradeRefusal } from "./upgrade-refusal.ts";

export type CarriedEntry = { readonly [key: string]: ReadonlyJsonValue };

export type CarveOutAnswer =
  | { readonly credit: "findings"; readonly checks: readonly Check[] }
  | { readonly credit: UnansweredCredit };

export type LocationAnswer =
  | { readonly reach: "answered-checks"; readonly checks: readonly Check[] }
  | { readonly reach: "whole-clause" };

type RecordOf<Kind extends ExceptionRecord["kind"]> = Extract<
  ExceptionRecord,
  { readonly kind: Kind }
>;

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

export type RecordsMappingRequest = {
  readonly inputs: readonly RecordInput[];
  readonly catalogues: readonly RuleSetCatalogue[];
};

export type WrittenRecord =
  | {
      readonly answers: string;
      readonly file: string;
      readonly note?: string;
      readonly carried?: CarriedEntry;
    }
  | { readonly answers: string; readonly file: string; readonly carried: CarriedEntry };

export type MappedRecordsDocument = {
  readonly file: RepoPath;
  readonly version: typeof RECORDS_VERSION;
  readonly records: readonly WrittenRecord[];
};

export type MappedRecords = { readonly documents: readonly MappedRecordsDocument[] };

export type RecordLine = {
  readonly oldKind: ExceptionRecord["kind"];
  readonly oldAddress: string;
  readonly file: string;
  readonly newKind: "debt" | "authorised-location";
  readonly symptom: string;
  readonly holding: "carried" | "stated";
};

type RecordOrigin = Pick<RecordLine, "oldKind" | "oldAddress" | "file">;

type MappedFolderKind = Extract<NamedFolderKind, "debt" | "authorised-locations">;

const NEW_KIND_OF_FOLDER: Readonly<Record<MappedFolderKind, RecordLine["newKind"]>> = {
  debt: "debt",
  "authorised-locations": "authorised-location",
};

type PlacedRecord = {
  readonly file: RepoPath;
  readonly record: WrittenRecord;
  readonly line: RecordLine;
};

type InputOutcome = {
  readonly placed: readonly PlacedRecord[];
  readonly refusals: readonly UpgradeRefusal[];
};

const refusedWith = (request: { readonly refusal: UpgradeRefusal }): InputOutcome => ({
  placed: [],
  refusals: [request.refusal],
});

const withoutRepeats = (request: { readonly checks: readonly Check[] }): readonly Check[] =>
  request.checks.filter(
    (check, index) =>
      request.checks.findIndex(
        (earlier) => checkAddressOf({ check: earlier }) === checkAddressOf({ check }),
      ) === index,
  );

const lineOf = (request: {
  readonly origin: RecordOrigin;
  readonly kind: MappedFolderKind;
  readonly record: WrittenRecord;
}): RecordLine => ({
  ...request.origin,
  newKind: NEW_KIND_OF_FOLDER[request.kind],
  symptom: request.record.answers,
  holding: request.record.carried === undefined ? "stated" : "carried",
});

const placedAt = (request: {
  readonly origin: RecordOrigin;
  readonly kind: MappedFolderKind;
  readonly check: Check;
  readonly record: WrittenRecord;
}): Result<PlacedRecord, UpgradeRefusal> => {
  const file = namedRecordsFileOf({ kind: request.kind, name: request.check.symptom.name });
  return file.outcome === "ok"
    ? {
        outcome: "ok",
        value: { file: file.value, record: request.record, line: lineOf(request) },
      }
    : {
        outcome: "failed",
        error: { kind: "records-name-refused", name: request.check.symptom.name },
      };
};

const outcomeOfPlacements = (request: {
  readonly placements: readonly Result<PlacedRecord, UpgradeRefusal>[];
}): InputOutcome => ({
  placed: request.placements.flatMap((placement) =>
    placement.outcome === "ok" ? [placement.value] : [],
  ),
  refusals: request.placements.flatMap((placement) =>
    placement.outcome === "failed" ? [placement.error] : [],
  ),
});

const noteOf = (request: { readonly reason: string | undefined }): { readonly note?: string } =>
  request.reason === undefined ? {} : { note: request.reason };

const originOf = (request: {
  readonly oldKind: RecordOrigin["oldKind"];
  readonly record: { readonly clause: ClauseAddress; readonly file: string };
}): RecordOrigin => ({
  oldKind: request.oldKind,
  oldAddress: clauseAddressText({ address: request.record.clause }),
  file: request.record.file,
});

const holdingOf = (request: {
  readonly record: RecordOf<"file-carve-out">;
}): "carried" | "stated" =>
  request.record.whyChain !== undefined || request.record.provenance !== undefined
    ? "carried"
    : "stated";

const debtRecordOf = (request: {
  readonly record: RecordOf<"file-carve-out">;
  readonly check: Check;
  readonly entry: CarriedEntry;
}): WrittenRecord => {
  const answers = checkAddressOf({ check: request.check });
  return holdingOf({ record: request.record }) === "carried"
    ? { answers, file: request.record.file, carried: request.entry }
    : { answers, file: request.record.file, ...noteOf({ reason: request.record.reason }) };
};

const carveOutOutcome = (request: {
  readonly input: Extract<RecordInput, { readonly kind: "file-carve-out" }>;
}): InputOutcome => {
  const { record, answer, entry } = request.input;
  if (answer.credit !== "findings") {
    return refusedWith({
      refusal: {
        kind: "record-answers-nothing",
        clause: clauseAddressText({ address: record.clause }),
        file: record.file,
        credited: answer.credit,
      },
    });
  }
  return outcomeOfPlacements({
    placements: withoutRepeats({ checks: answer.checks }).map((check) =>
      placedAt({
        origin: originOf({ oldKind: "file-carve-out", record }),
        kind: "debt",
        check,
        record: debtRecordOf({ record, check, entry }),
      }),
    ),
  });
};

const checksAnsweredBy = (request: {
  readonly answer: LocationAnswer;
  readonly clauseChecks: readonly Check[];
}): readonly Check[] =>
  request.answer.reach === "answered-checks"
    ? withoutRepeats({ checks: request.answer.checks })
    : request.clauseChecks;

const authorisedLocationOutcome = (request: {
  readonly input: Extract<RecordInput, { readonly kind: "authorised-location" }>;
  readonly catalogues: readonly RuleSetCatalogue[];
}): InputOutcome => {
  const { record, entry, answer } = request.input;
  const clauseChecks = checksOfClause({ catalogues: request.catalogues, clause: record.clause });
  if (clauseChecks.length === 0) {
    return refusedWith({
      refusal: {
        kind: "clause-without-check",
        clause: clauseAddressText({ address: record.clause }),
      },
    });
  }
  return outcomeOfPlacements({
    placements: checksAnsweredBy({ answer, clauseChecks }).map((check) =>
      placedAt({
        origin: originOf({ oldKind: "authorised-location", record }),
        kind: "authorised-locations",
        check,
        record: { answers: checkAddressOf({ check }), file: record.file, carried: entry },
      }),
    ),
  });
};

const outcomeOf = (request: {
  readonly input: RecordInput;
  readonly catalogues: readonly RuleSetCatalogue[];
}): InputOutcome => {
  const { input } = request;
  switch (input.kind) {
    case "file-carve-out":
      return carveOutOutcome({ input });
    case "authorised-location":
      return authorisedLocationOutcome({ input, catalogues: request.catalogues });
    case "clause-wide-carve-out":
      return refusedWith({
        refusal: {
          kind: "clause-wide-carve-out",
          clause: clauseAddressText({ address: input.record.clause }),
        },
      });
  }
};

const documentsOf = (request: {
  readonly placed: readonly PlacedRecord[];
}): readonly MappedRecordsDocument[] =>
  [...new Set(request.placed.map(({ file }) => file))]
    .toSorted((left, right) => codePointOrder({ left, right }))
    .map((file) => ({
      file,
      version: RECORDS_VERSION,
      records: request.placed.filter((placed) => placed.file === file).map(({ record }) => record),
    }));

export const mappedRecords = (
  request: RecordsMappingRequest,
): Result<MappedRecords, readonly UpgradeRefusal[]> => {
  const outcomes = request.inputs.map((input) =>
    outcomeOf({ input, catalogues: request.catalogues }),
  );
  const refusals = outcomes.flatMap((outcome) => outcome.refusals);
  return refusals.length > 0
    ? { outcome: "failed", error: refusals }
    : {
        outcome: "ok",
        value: {
          documents: documentsOf({ placed: outcomes.flatMap((outcome) => outcome.placed) }),
        },
      };
};

export const recordLinesOf = (request: RecordsMappingRequest): readonly RecordLine[] =>
  request.inputs.flatMap((input) =>
    outcomeOf({ input, catalogues: request.catalogues }).placed.map(({ line }) => line),
  );
