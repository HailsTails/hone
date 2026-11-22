import type {
  AuthorisedReach,
  CarriedListing,
  CatalogueNote,
  HoneRecord,
  OutsideParty,
  PlacedRecord,
  RecordIssue,
  RecordNote,
  RecordPlace,
  RecordRefusal,
  RefusedRecord,
} from "../../../domain/records/hone-records/hone-record.ts";
import { catalogueNotesOf } from "../../../domain/records/hone-records/record-listings.ts";
import { checkAddressOf } from "../../../domain/language-layer/check-address.ts";
import type { Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import { onOneLine, quoted } from "../printed-text.ts";

const WHOLE_RECORD = "record";

const SPLITS_A_FIELD = /[\s"]/;

export const recordsFileText = (request: { readonly file: RepoPath }): string => (SPLITS_A_FIELD.test(request.file) ? quoted({ text: request.file }) : request.file);

export const recordPlaceText = (request: { readonly place: RecordPlace }): string => `${recordsFileText(request.place)} records[${request.place.index}]`;

export const outsidePartyText = (request: { readonly party: OutsideParty }): string => {
  switch (request.party.kind) {
    case "package":
    case "scheme-module":
      return request.party.specifier;
    case "runtime":
      return `runtime:${request.party.facility}`;
  }
};

const catalogueNoteWords = (request: { readonly note: CatalogueNote }): string => {
  switch (request.note.kind) {
    case "unknown-check":
      return `the catalogue has no check ${quoted({ text: request.note.check })} of ${request.note.symptom.name}`;
    case "unknown-case":
      return `the catalogue has no case ${quoted({ text: request.note.case })}, owing ${quoted({ text: request.note.owes })}`;
    case "owes-not-owed":
      return `${request.note.case.name} does not owe ${quoted({ text: request.note.owes })}`;
  }
};

const carriedText = (request: { readonly holding: { readonly held: "stated" | "carried" } }): string => (request.holding.held === "carried" ? " carried" : "");

const heldText = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "boundary-record":
      return carriedText(record);
    case "authorised-location":
      return `${carriedText(record)}${catalogueNotesOf({ record })
        .map((note) => ` note: ${catalogueNoteWords({ note })}`)
        .join("")}`;
    case "deviation":
    case "dependency-record":
      return "";
  }
};

const reachedText = (request: { readonly symptom: Symptom; readonly reach: AuthorisedReach }): string => {
  const { symptom, reach } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return symptom.name;
    case "one-check":
      return checkAddressOf({ check: reach.check });
    case "unknown-check":
      return `${symptom.name}#${reach.check}`;
  }
};

const subjectOf = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return `${reachedText(record)} ${record.kind} ${record.file}`;
    case "deviation":
      return `${record.recipe.name} ${record.kind} ${record.file}`;
    case "boundary-record":
      return `${outsidePartyText({ party: record.outsideParty })} ${record.kind} ${record.module}`;
    case "dependency-record":
      return `${record.dependency} ${record.kind}`;
  }
};

const referenceOf = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return record.kind;
    case "deviation":
      return `${record.kind} ${record.recipe.name}`;
    case "boundary-record":
      return `${record.kind} ${outsidePartyText({ party: record.outsideParty })}`;
    case "dependency-record":
      return `${record.kind} ${record.dependency}`;
  }
};

export const recordSubjectText = (request: { readonly record: HoneRecord }): string => `${subjectOf(request)}${heldText(request)}`;

export const recordReferenceText = (request: { readonly record: HoneRecord }): string => `${referenceOf(request)}${heldText(request)}`;

export const referencesText = (request: { readonly lead: string; readonly records: readonly PlacedRecord[] }): string =>
  request.records.map((placed) => ` ${request.lead} ${recordReferenceText({ record: placed.record })}`).join("");

export const recordNoteLine = (request: { readonly recordNote: RecordNote }): string =>
  `${recordPlaceText(request.recordNote)} ${request.recordNote.note.kind}: ${catalogueNoteWords(request.recordNote)}`;

const issueText = (request: { readonly issue: RecordIssue }): string => {
  const path = request.issue.path.length === 0 ? WHOLE_RECORD : request.issue.path.join(".");
  return `${path}: ${request.issue.message}`;
};

const refusalDetail = (request: { readonly refusal: RecordRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "form-refused":
      return ` ${onOneLine({ text: refusal.issues.map((issue) => issueText({ issue })).join("; ") })}`;
    case "unknown-symptom":
      return ` ${quoted({ text: refusal.symptom })}`;
    case "unknown-check":
      return ` ${quoted({ text: refusal.check })} of ${refusal.symptom}`;
    case "unknown-recipe":
      return ` ${quoted({ text: refusal.recipe })}`;
    case "recipe-reason-not-the-catalogues":
      return ` ${refusal.recipe.name}: the catalogue gives its reason as ${quoted({ text: refusal.recipe.reason.text })}`;
    case "named-ban":
      return ` ${refusal.dependency}`;
    case "unknown-runtime-facility":
      return ` ${refusal.outsideParty}`;
    case "misplaced":
      return ` ${refusal.belongsIn}`;
    case "not-a-records-name":
      return ` ${quoted({ text: refusal.name })}`;
    case "carried-changed-since-base":
      return "";
    case "duplicate":
      return ` of ${recordPlaceText({ place: refusal.of })}`;
  }
};

export const refusalText = (request: { readonly refusal: RecordRefusal }): string => `${request.refusal.kind}${refusalDetail(request)}`;

export const refusedLines = (request: { readonly refused: RefusedRecord }): readonly string[] =>
  request.refused.refusals.map((refusal) => `${recordPlaceText(request.refused)} ${refusal.kind}${refusalDetail({ refusal })}`);

export const carriedLine = (request: { readonly listing: CarriedListing }): string => {
  const lacks = request.listing.lacks.length === 0 ? "" : ` lacks ${request.listing.lacks.join(", ")}`;
  return `${recordPlaceText(request.listing)} ${request.listing.standing}${lacks}`;
};
