import type { ClauseChecks } from "../../language-layer/clause-checks.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { ConsumerSelectionFile } from "../../settings/selection/selection-file.ts";
import { codePointOrder } from "../code-point-order.ts";
import { RECORDS_VERSION } from "../hone-records/records-layout.ts";
import {
  type AuthorisationContent,
  mappedRecords,
  type MappedRecordsDocument,
  type RecordInput,
} from "./records-mapping.ts";
import { type ConfinedPackages, readConfinedPackages } from "./selection-mapping.ts";

export type BaseSelection =
  | { readonly presence: "absent-from-base" }
  | { readonly presence: "present-in-base"; readonly selection: ConsumerSelectionFile }
  | { readonly presence: "unreadable-in-base" };

export type BaseEntryRequest = {
  readonly selection: BaseSelection;
  readonly input: RecordInput;
  readonly clauseChecks: ClauseChecks;
  readonly content: AuthorisationContent;
};

export type BaseEntryStanding =
  | { readonly standing: "held-at-base"; readonly documents: readonly MappedRecordsDocument[] }
  | {
      readonly standing: "held-without-parties-at-base";
      readonly documents: readonly MappedRecordsDocument[];
    }
  | { readonly standing: "not-held-at-base" };

type ConfinedAtBase =
  | Extract<ConfinedPackages, { readonly confined: "listed" }>
  | { readonly confined: "unreadable" };

const NO_SELECTION_CONFINES_NOTHING: ConfinedAtBase = { confined: "listed", packages: [] };

const UNREADABLE_AT_BASE: ConfinedAtBase = { confined: "unreadable" };

const readConfinedAtBase = (request: { readonly selection: BaseSelection }): ConfinedAtBase => {
  const { selection } = request;
  switch (selection.presence) {
    case "absent-from-base":
      return NO_SELECTION_CONFINES_NOTHING;
    case "present-in-base": {
      const confined = readConfinedPackages({ selection: selection.selection });
      return confined.confined === "listed" ? confined : UNREADABLE_AT_BASE;
    }
    case "unreadable-in-base":
      return UNREADABLE_AT_BASE;
  }
};

const mapDocumentsToPartyless = (request: {
  readonly documents: readonly MappedRecordsDocument[];
}): readonly MappedRecordsDocument[] =>
  request.documents.flatMap((document) => {
    const records = document.records.filter((record) => !("outsideParty" in record));
    return records.length === 0 ? [] : [{ ...document, records }];
  });

export const createBaseEntryStanding = (request: BaseEntryRequest): BaseEntryStanding => {
  const confined = readConfinedAtBase({ selection: request.selection });
  const mapped = mappedRecords({
    inputs: [request.input],
    clauseChecks: request.clauseChecks,
    content: request.content,
    confinedOutsideDependencies: confined.confined === "listed" ? confined.packages : [],
  });
  if (mapped.outcome === "failed") {
    return { standing: "not-held-at-base" };
  }
  return confined.confined === "listed"
    ? { standing: "held-at-base", documents: mapped.value.documents }
    : {
        standing: "held-without-parties-at-base",
        documents: mapDocumentsToPartyless({ documents: mapped.value.documents }),
      };
};

export const mapStandingsToHeldDocuments = (request: {
  readonly standings: readonly BaseEntryStanding[];
}): readonly MappedRecordsDocument[] => {
  const held = request.standings.flatMap((each) =>
    each.standing === "not-held-at-base" ? [] : each.documents,
  );
  const files: readonly RepoPath[] = [...new Set(held.map(({ file }) => file))];
  return files
    .toSorted((left, right) => codePointOrder({ left, right }))
    .map((file) => ({
      file,
      version: RECORDS_VERSION,
      records: held.filter((document) => document.file === file).flatMap(({ records }) => records),
    }));
};
