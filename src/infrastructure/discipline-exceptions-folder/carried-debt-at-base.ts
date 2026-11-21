import { z } from "zod";
import type { RecordsDocument } from "../hone-records-folder/hone-record.ts";
import { namedRecordsFileOf } from "../hone-records-folder/folder-layout/records-layout.ts";
import { RECORDS_VERSION } from "../hone-records-folder/records-wire.ts";
import type { RuleSetCatalogue } from "../../domain/settings/check-choices.ts";
import { checkAddressOf } from "../../domain/language-layer/check-address.ts";
import type { Check } from "../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import { type RepoPath, repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { checksOfClause } from "../../application/upgrade/mapping/clause-checks.ts";
import type { VersionOneEntry } from "./version-one-entries.ts";

const carveOutEntrySchema = z.looseObject({ kind: z.literal("file-carve-out"), clause: clauseAddressSchema, file: repoPathSchema });

type PlacedDebt = { readonly file: RepoPath; readonly record: { readonly answers: string; readonly file: RepoPath; readonly carried: VersionOneEntry } };

const debtAt = (request: { readonly check: Check; readonly entry: VersionOneEntry; readonly file: RepoPath }): readonly PlacedDebt[] => {
  const filed = namedRecordsFileOf({ kind: "debt", name: request.check.symptom.name });
  return filed.outcome === "ok"
    ? [{ file: filed.value, record: { answers: checkAddressOf({ check: request.check }), file: request.file, carried: request.entry } }]
    : [];
};

const debtOf = (request: { readonly entry: VersionOneEntry; readonly catalogues: readonly RuleSetCatalogue[] }): readonly PlacedDebt[] => {
  const parsed = carveOutEntrySchema.safeParse(request.entry);
  return parsed.success
    ? checksOfClause({ catalogues: request.catalogues, clause: parsed.data.clause }).flatMap((check) => debtAt({ check, entry: request.entry, file: parsed.data.file }))
    : [];
};

export const carriedDebtDocumentsAtBaseOf = (request: {
  readonly entries: readonly VersionOneEntry[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly RecordsDocument[] => {
  const placed = request.entries.flatMap((entry) => debtOf({ entry, catalogues: request.catalogues }));
  return [...new Set(placed.map(({ file }) => file))].map((file) => ({
    file,
    document: { version: RECORDS_VERSION, records: placed.filter((debt) => debt.file === file).map(({ record }) => record) },
  }));
};
