import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type {
  RecordPlace,
  RecordRefusal,
  RecordsAtBase,
  RecordsDocument,
} from "../../domain/records/hone-records/hone-record.ts";
import type { RecordAddition } from "../../domain/records/hone-records/records-edit.ts";
import { namedRecordsFileOf } from "../../domain/records/hone-records/records-layout.ts";
import { symptomNameOf } from "../../domain/records/record-address.ts";
import type { Result } from "../../domain/result.ts";
import type { AuthoriseRequest, Authorising } from "../ports/authorising.ts";
import type { RecordsEditFailure, RecordsEditor } from "../ports/records/records-editor.ts";
import type { RecordsReader } from "../ports/records/records-reader.ts";

export type AuthorisingPorts = {
  readonly recordsReader: Pick<RecordsReader, "recordsReadingOf">;
  readonly recordsEditor: Pick<RecordsEditor, "documentsWithAdded" | "placeOfAddition">;
};

type Judging = AuthorisingPorts & {
  readonly documents: readonly RecordsDocument[];
  readonly catalogue: SymptomCatalogue;
  readonly addition: RecordAddition;
};

const UNMEASURED_BASE: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const createEntry = (request: { readonly request: AuthoriseRequest }): RecordAddition["entry"] => {
  const {
    answers,
    file,
    outsideParty,
    case: caseName,
    owes,
    whys,
    rootCause,
    rootEvidence,
    readback,
    owner,
  } = request.request;
  return {
    answers: answers.name,
    file,
    ...(outsideParty === undefined ? {} : { outsideParty }),
    case: caseName,
    owes,
    whyChain: { whys, rootCause, rootEvidence, readback, owner },
  };
};

const refusedOutcome = (request: { readonly refusals: readonly RecordRefusal[] }): Authorising => {
  const [first] = request.refusals;
  return request.refusals.length === 1 && first?.kind === "duplicate"
    ? { judged: "already-held", heldIn: first.of.file }
    : { judged: "refused", refusals: request.refusals };
};

const refusalsAt = (request: {
  readonly refused: readonly {
    readonly place: RecordPlace;
    readonly refusals: readonly RecordRefusal[];
  }[];
  readonly place: RecordPlace;
}): readonly RecordRefusal[] =>
  request.refused
    .filter(
      (candidate) =>
        candidate.place.file === request.place.file &&
        candidate.place.index === request.place.index,
    )
    .flatMap((candidate) => candidate.refusals);

const judgedAddition = (request: Judging): Result<Authorising, RecordsEditFailure> => {
  const added = request.recordsEditor.documentsWithAdded({
    documents: request.documents,
    additions: [request.addition],
  });
  if (added.outcome === "failed") {
    return added;
  }
  const reading = request.recordsReader.recordsReadingOf({
    documents: [
      ...request.documents.filter((document) => document.file !== request.addition.file),
      ...added.value,
    ],
    catalogue: request.catalogue,
    base: UNMEASURED_BASE,
  });
  if (reading.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-documents", refusals: reading.error } };
  }
  const refusals = refusalsAt({
    refused: reading.value.refused,
    place: request.recordsEditor.placeOfAddition(request),
  });
  return {
    outcome: "ok",
    value:
      refusals.length === 0
        ? { judged: "accepted", edit: { write: added.value, remove: [] } }
        : refusedOutcome({ refusals }),
  };
};

export const authorisingOf = (
  request: AuthorisingPorts & {
    readonly request: AuthoriseRequest;
    readonly documents: readonly RecordsDocument[];
    readonly catalogue: SymptomCatalogue;
  },
): Result<Authorising, RecordsEditFailure> => {
  const { answers } = request.request;
  const file = namedRecordsFileOf({
    ruleSet: answers.ruleSet,
    kind: "authorised-locations",
    name: symptomNameOf({ address: answers.name }),
  });
  if (file.outcome === "failed") {
    return { outcome: "ok", value: { judged: "refused", refusals: [file.error] } };
  }
  return judgedAddition({
    recordsReader: request.recordsReader,
    recordsEditor: request.recordsEditor,
    documents: request.documents,
    catalogue: request.catalogue,
    addition: { file: file.value, entry: createEntry({ request: request.request }) },
  });
};
