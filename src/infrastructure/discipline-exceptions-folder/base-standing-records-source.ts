import type { ExceptionRepository } from "../../application/ports/records/exception-repository.ts";
import type { RecordsSourceOf } from "../../application/ports/records/records-source-of.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import { createClauseChecks } from "../../domain/language-layer/clause-checks.ts";
import { createRuleContent } from "../../domain/language-layer/rule-content.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import {
  createBaseEntryStanding,
  mapStandingsToHeldDocuments,
} from "../../domain/records/upgrade/base-standing-documents.ts";
import type { RecordInput } from "../../domain/records/upgrade/records-mapping.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { carriedDebtDocumentsAtBaseOf } from "./carried-debt-at-base.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import {
  type BaseEntry,
  type VersionOneEntries,
  versionOneEntriesOf,
} from "./version-one-entries.ts";

const createLocationInput = (request: { readonly base: BaseEntry }): readonly RecordInput[] => {
  const { entry, carried } = request.base;
  if (entry.kind !== "authorised-location") {
    return [];
  }
  const clause = clauseAddressSchema.safeParse(entry.clause);
  const file = repoPathSchema.safeParse(entry.file);
  return clause.success && file.success
    ? [
        {
          kind: "authorised-location",
          record: { clause: clause.data, file: file.data },
          entry: carried,
          answer: { reach: "whole-clause" },
        },
      ]
    : [];
};

export const baseStandingRecordsSource = (request: {
  readonly source: RecordsSource;
  readonly entries: VersionOneEntries;
  readonly catalogue: SymptomCatalogue;
}): RecordsSource => ({
  read: request.source.read,
  readAt: ({ revision }) => {
    const base = request.source.readAt({ revision });
    if (base.outcome === "failed") {
      return base;
    }
    const entries = request.entries.atBase({ revision });
    if (entries.outcome === "failed") {
      return entries;
    }
    const selection = request.entries.selectionAtBase({ revision });
    if (selection.outcome === "failed") {
      return selection;
    }
    const clauseChecks = createClauseChecks({ catalogues: [{ catalogue: request.catalogue }] });
    const content = createRuleContent({ catalogues: [request.catalogue] });
    const standings = entries.value
      .flatMap((each) => createLocationInput({ base: each }))
      .map((input) =>
        createBaseEntryStanding({ selection: selection.value, input, clauseChecks, content }),
      );
    const heldAtBase = new Set(base.value.map(({ file }) => file));
    const absentAtBase = [
      ...mapStandingsToHeldDocuments({ standings }).map(({ file, version, records }) => ({
        file,
        document: { version, records },
      })),
      ...carriedDebtDocumentsAtBaseOf({
        entries: entries.value.map(({ carried }) => carried),
        clauseChecks,
      }),
    ].filter(({ file }) => !heldAtBase.has(file));
    return { outcome: "ok", value: [...base.value, ...absentAtBase] };
  },
});

export const versionOneAwareRecordsSourceOf =
  (request: {
    readonly recordsSourceOf: RecordsSourceOf;
    readonly exceptionRepositoryOf: (request: {
      readonly repoRoot: AbsolutePath;
    }) => Pick<ExceptionRepository, "readAt">;
  }): RecordsSourceOf =>
  (folder) =>
    baseStandingRecordsSource({
      source: request.recordsSourceOf(folder),
      entries: versionOneEntriesOf({
        repository: request.exceptionRepositoryOf({ repoRoot: folder.repoRoot }),
        git: folder.git,
        repoRoot: folder.repoRoot,
      }),
      catalogue: folder.catalogue,
    });
