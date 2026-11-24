import { checkAddressOf } from "../../language-layer/check-address.ts";
import { type ClauseChecks, readChecksOfClause } from "../../language-layer/clause-checks.ts";
import {
  mapAddressToSymptom,
  type RuleContent,
  type SymptomUnheld,
} from "../../language-layer/rule-content.ts";
import { type Check, mapSymptomToAuthorisation } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { Result } from "../../result.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../rule-set/clause-address.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import { codePointOrder } from "../code-point-order.ts";
import type { ExceptionRecord } from "../discipline-exceptions/exception-record.ts";
import type { NamedFolderKind } from "../hone-records/named-folder-kind.ts";
import { RECORDS_VERSION, namedRecordsFileOf } from "../hone-records/records-layout.ts";
import type { UpgradeRefusal } from "./upgrade-refusal.ts";

export type CarriedEntry = { readonly [key: string]: ReadonlyJsonValue };

export type CarveOutAnswer =
  | { readonly credit: "findings" | "suppression-only"; readonly checks: readonly Check[] }
  | { readonly credit: "nothing" };

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

export type AuthorisationContent = RuleContent<"correctUses">;

export type RecordsMappingRequest = {
  readonly inputs: readonly RecordInput[];
  readonly clauseChecks: ClauseChecks;
  readonly content: AuthorisationContent;
  readonly confinedOutsideDependencies: readonly string[];
};

export type WrittenRecord =
  | {
      readonly answers: string;
      readonly file: string;
      readonly note?: string;
      readonly carried?: CarriedEntry;
    }
  | {
      readonly answers: string;
      readonly file: string;
      readonly outsideParty?: string;
      readonly carried: CarriedEntry;
    };

export type MappedRecordsDocument = {
  readonly file: RepoPath;
  readonly version: typeof RECORDS_VERSION;
  readonly records: readonly WrittenRecord[];
};

export type PlacedRecordLine = {
  readonly recordKind: Exclude<ExceptionRecord["kind"], "clause-wide-carve-out">;
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly newKind: "debt" | "authorised-location";
  readonly check: Check;
  readonly outsideParty?: string;
  readonly holding: "carried" | "stated";
};

export type NotAdoptedLine = {
  readonly recordKind: "clause-wide-carve-out";
  readonly clause: ClauseAddress;
  readonly newKind: "not-adopted";
  readonly check: Check;
};

export type CarveOutReasonLine = {
  readonly recordKind: "clause-wide-carve-out";
  readonly clause: ClauseAddress;
  readonly reason: string;
};

export type NotCarriedLine = {
  readonly recordKind: "file-carve-out";
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly newKind: "not-carried";
};

export type RecordLine = PlacedRecordLine | NotCarriedLine | NotAdoptedLine | CarveOutReasonLine;

export type MappedRecords = {
  readonly documents: readonly MappedRecordsDocument[];
  readonly lines: readonly RecordLine[];
};

type RecordOrigin = Pick<PlacedRecordLine, "recordKind" | "clause" | "file">;

type MappedFolderKind = Extract<NamedFolderKind, "debt" | "authorised-locations">;

const NEW_KIND_OF_FOLDER: Readonly<Record<MappedFolderKind, PlacedRecordLine["newKind"]>> = {
  debt: "debt",
  "authorised-locations": "authorised-location",
};

type PlacedRecord = {
  readonly file: RepoPath;
  readonly record: WrittenRecord;
  readonly line: PlacedRecordLine;
};

type InputOutcome = {
  readonly placed: readonly PlacedRecord[];
  readonly choices: readonly RecordLine[];
  readonly refusals: readonly UpgradeRefusal[];
};

const refusedWith = (request: { readonly refusal: UpgradeRefusal }): InputOutcome => ({
  placed: [],
  choices: [],
  refusals: [request.refusal],
});

const withoutRepeats = (request: { readonly checks: readonly Check[] }): readonly Check[] =>
  request.checks.filter(
    (check, index) =>
      request.checks.findIndex(
        (earlier) => checkAddressOf({ check: earlier }) === checkAddressOf({ check }),
      ) === index,
  );

const mapRecordToParty = (request: {
  readonly record: WrittenRecord;
}): Pick<PlacedRecordLine, "outsideParty"> =>
  "outsideParty" in request.record && request.record.outsideParty !== undefined
    ? { outsideParty: request.record.outsideParty }
    : {};

const lineOf = (request: {
  readonly origin: RecordOrigin;
  readonly kind: MappedFolderKind;
  readonly check: Check;
  readonly record: WrittenRecord;
}): PlacedRecordLine => ({
  ...request.origin,
  newKind: NEW_KIND_OF_FOLDER[request.kind],
  check: request.check,
  ...mapRecordToParty({ record: request.record }),
  holding: request.record.carried === undefined ? "stated" : "carried",
});

const placedAt = (request: {
  readonly origin: RecordOrigin;
  readonly kind: MappedFolderKind;
  readonly check: Check;
  readonly record: WrittenRecord;
}): Result<PlacedRecord, UpgradeRefusal> => {
  const file = namedRecordsFileOf({
    ruleSet: request.check.symptom.ruleSet,
    kind: request.kind,
    name: request.check.symptom.name,
  });
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
  choices: [],
  refusals: request.placements.flatMap((placement) =>
    placement.outcome === "failed" ? [placement.error] : [],
  ),
});

const noteOf = (request: { readonly reason: string | undefined }): { readonly note?: string } =>
  request.reason === undefined ? {} : { note: request.reason };

const originOf = (request: {
  readonly recordKind: RecordOrigin["recordKind"];
  readonly record: { readonly clause: ClauseAddress; readonly file: RepoPath };
}): RecordOrigin => ({
  recordKind: request.recordKind,
  clause: request.record.clause,
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

const checksCarriedBy = (request: { readonly answer: CarveOutAnswer }): readonly Check[] =>
  request.answer.credit === "nothing" ? [] : request.answer.checks;

const carveOutOutcome = (request: {
  readonly input: Extract<RecordInput, { readonly kind: "file-carve-out" }>;
}): InputOutcome => {
  const { record, answer, entry } = request.input;
  const carried = checksCarriedBy({ answer });
  if (carried.length === 0) {
    return {
      placed: [],
      choices: [
        {
          recordKind: "file-carve-out",
          clause: record.clause,
          file: record.file,
          newKind: "not-carried",
        },
      ],
      refusals: [],
    };
  }
  return outcomeOfPlacements({
    placements: withoutRepeats({ checks: carried }).map((check) =>
      placedAt({
        origin: originOf({ recordKind: "file-carve-out", record }),
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

const NODE_SCHEME = "node:";

const createLocationRecords = (request: {
  readonly check: Check;
  readonly file: RepoPath;
  readonly entry: CarriedEntry;
  readonly content: AuthorisationContent;
  readonly confinedOutsideDependencies: readonly string[];
}): Result<readonly WrittenRecord[], SymptomUnheld> => {
  const { check, file, entry } = request;
  const symptom = mapAddressToSymptom({ content: request.content, symptom: check.symptom });
  if (symptom.outcome === "failed") {
    return symptom;
  }
  const answers = checkAddressOf({ check });
  return {
    outcome: "ok",
    value:
      mapSymptomToAuthorisation({ symptom: symptom.value }) === "check-file-and-outside-party"
        ? [...new Set([...request.confinedOutsideDependencies, NODE_SCHEME])].map(
            (outsideParty) => ({ answers, file, outsideParty, carried: entry }),
          )
        : [{ answers, file, carried: entry }],
  };
};

const authorisedLocationOutcome = (request: {
  readonly input: Extract<RecordInput, { readonly kind: "authorised-location" }>;
  readonly clauseChecks: ClauseChecks;
  readonly content: AuthorisationContent;
  readonly confinedOutsideDependencies: readonly string[];
}): InputOutcome => {
  const { record, entry, answer } = request.input;
  const clauseChecks = readChecksOfClause({
    clauseChecks: request.clauseChecks,
    clause: record.clause,
  });
  if (clauseChecks.length === 0) {
    return refusedWith({
      refusal: {
        kind: "clause-without-check",
        clause: clauseAddressText({ address: record.clause }),
      },
    });
  }
  return outcomeOfPlacements({
    placements: checksAnsweredBy({ answer, clauseChecks }).flatMap((check) => {
      const written = createLocationRecords({
        check,
        file: record.file,
        entry,
        content: request.content,
        confinedOutsideDependencies: request.confinedOutsideDependencies,
      });
      return written.outcome === "failed"
        ? [written]
        : written.value.map((each) =>
            placedAt({
              origin: originOf({ recordKind: "authorised-location", record }),
              kind: "authorised-locations",
              check,
              record: each,
            }),
          );
    }),
  });
};

const notAdoptedLinesOf = (request: {
  readonly record: RecordOf<"clause-wide-carve-out">;
  readonly checks: readonly Check[];
}): readonly RecordLine[] => {
  const { clause } = request.record;
  return [
    { recordKind: "clause-wide-carve-out", clause, reason: request.record.reason },
    ...request.checks.map((check): NotAdoptedLine => ({
      recordKind: "clause-wide-carve-out",
      clause,
      newKind: "not-adopted",
      check,
    })),
  ];
};

const clauseWideCarveOutOutcome = (request: {
  readonly input: Extract<RecordInput, { readonly kind: "clause-wide-carve-out" }>;
  readonly clauseChecks: ClauseChecks;
}): InputOutcome => {
  const { record } = request.input;
  const checks = readChecksOfClause({ clauseChecks: request.clauseChecks, clause: record.clause });
  return checks.length === 0
    ? refusedWith({
        refusal: {
          kind: "clause-without-check",
          clause: clauseAddressText({ address: record.clause }),
        },
      })
    : { placed: [], choices: notAdoptedLinesOf({ record, checks }), refusals: [] };
};

const outcomeOf = (request: {
  readonly input: RecordInput;
  readonly clauseChecks: ClauseChecks;
  readonly content: AuthorisationContent;
  readonly confinedOutsideDependencies: readonly string[];
}): InputOutcome => {
  const { input } = request;
  switch (input.kind) {
    case "file-carve-out":
      return carveOutOutcome({ input });
    case "authorised-location":
      return authorisedLocationOutcome({
        input,
        clauseChecks: request.clauseChecks,
        content: request.content,
        confinedOutsideDependencies: request.confinedOutsideDependencies,
      });
    case "clause-wide-carve-out":
      return clauseWideCarveOutOutcome({ input, clauseChecks: request.clauseChecks });
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
    outcomeOf({
      input,
      clauseChecks: request.clauseChecks,
      content: request.content,
      confinedOutsideDependencies: request.confinedOutsideDependencies,
    }),
  );
  const refusals = outcomes.flatMap((outcome) => outcome.refusals);
  const placed = outcomes.flatMap((outcome) => outcome.placed);
  const lines = outcomes.flatMap((outcome) => [
    ...outcome.placed.map(({ line }) => line),
    ...outcome.choices,
  ]);
  return refusals.length > 0
    ? { outcome: "failed", error: refusals }
    : { outcome: "ok", value: { documents: documentsOf({ placed }), lines } };
};

export type CarriedClause = {
  readonly kind: RecordInput["kind"];
  readonly record: { readonly clause: ClauseAddress };
};

export const clausesCarriedAsNotAdopted = (request: {
  readonly inputs: readonly CarriedClause[];
}): readonly ClauseAddress[] =>
  request.inputs.flatMap((input) =>
    input.kind === "clause-wide-carve-out" ? [input.record.clause] : [],
  );
