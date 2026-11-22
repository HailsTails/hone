import { z } from "zod";

import type { ExceptionEntryParser } from "../../application/ports/records/exception-entries.ts";
import {
  type ExceptionBaseline,
  type MeasuredBaseline,
  judgedAtBase,
} from "../../domain/records/discipline-exceptions/exception-baseline.ts";
import type {
  ImportEvidence,
  PlacedEntry,
  StructuralExceptionEntry,
} from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type {
  AuthorisedLocationEntry,
  ExceptionReading,
  ExceptionRecord,
  FileCarveOutEntry,
  InvalidRecord,
  RecordPlace,
} from "../../domain/records/discipline-exceptions/exception-record.ts";
import type { RecordedWhyChain } from "../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { basePathOf } from "../../domain/repository/renamed-path.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { sameClauseAddress } from "../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import { TOOL_IDENTITY } from "../../domain/rule-set/tool-identity.ts";
import type { FileExceptionWhyChains } from "../../domain/settings/selection/file-exception-why-chains.ts";
import type { Selection } from "../../domain/settings/selection/selection.ts";
import { parsedJson } from "../content-files/rule-sets/rule-set-reader.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import { legacyWhyChainSchema, versionOneWhyChainSchema } from "./version-one-why-chain.ts";

type IndexedRecord = {
  readonly index: number;
  readonly place: RecordPlace;
  readonly record: ExceptionRecord;
};

type EntryProblem = InvalidRecord["problem"];

const exceptionsFileSchema = z.object({
  version: z.literal(1),
  exceptions: z.array(
    z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("authorised-location"),
        clause: z.string(),
        file: z.string(),
        reason: z.string(),
        whyChain: z.unknown().optional(),
        provenance: z.unknown().optional(),
      }),
      z.strictObject({
        kind: z.literal("file-carve-out"),
        clause: z.string(),
        file: z.string(),
        reason: z.string().optional(),
        whyChain: z.unknown().optional(),
        provenance: z.unknown().optional(),
      }),
      z.strictObject({
        kind: z.literal("clause-wide-carve-out"),
        clause: z.string(),
        reason: z.string(),
        whyChain: z.unknown(),
      }),
    ]),
  ),
});

export const isStructuralExceptionEntryEqual: Equal<
  z.infer<typeof exceptionsFileSchema>["exceptions"][number],
  StructuralExceptionEntry
> = true;

export const exceptionEntriesOfDocument = (request: {
  readonly document: unknown;
}): Result<readonly StructuralExceptionEntry[], { readonly detail: string }> => {
  const parsed = exceptionsFileSchema.safeParse(request.document);
  return parsed.success
    ? { outcome: "ok", value: parsed.data.exceptions }
    : { outcome: "failed", error: { detail: z.prettifyError(parsed.error) } };
};

const RECORDS_DOCUMENT_KEYS: readonly string[] = Object.keys(exceptionsFileSchema.shape);

const documentKeysSchema = z.record(z.string(), z.unknown());

export const foreignKeysOfDocument = (request: {
  readonly document: unknown;
}): readonly string[] => {
  const keys = documentKeysSchema.safeParse(request.document);
  return keys.success
    ? Object.keys(keys.data).filter((key) => !RECORDS_DOCUMENT_KEYS.includes(key))
    : [];
};

const LEGACY_DIRECTORY_OF = {
  "inherited-debt": ".constitution-carve-outs",
  "existing-authorisation": ".constitution-authorised-locations",
} as const;

type ImportProvenanceKind = keyof typeof LEGACY_DIRECTORY_OF;

const LEGACY_SOURCE = /^(?<directory>[^/#]+)\/(?<stem>cd-[0-9a-z]+)\.json#(?<index>\d+)$/;

const legacySourceGroupsSchema = z.object({
  directory: z.enum([
    LEGACY_DIRECTORY_OF["inherited-debt"],
    LEGACY_DIRECTORY_OF["existing-authorisation"],
  ]),
  stem: z.string(),
  index: z.coerce.number().int().nonnegative(),
});

const legacyRecordsSchema = z.array(z.looseObject({ files: z.array(z.string()) }));

type LegacySource = {
  readonly path: RepoPath;
  readonly directory: z.infer<typeof legacySourceGroupsSchema>["directory"];
  readonly discipline: string;
  readonly index: number;
};

const recordedTextSchema = z
  .string()
  .refine((text) => text.trim().length > 0, { error: "must not be blank" });

const existingAuthorisationProvenanceSchema = z.strictObject({
  kind: z.literal("existing-authorisation"),
  source: recordedTextSchema,
  decision: recordedTextSchema.optional(),
});

const inheritedDebtProvenanceSchema = z.strictObject({
  kind: z.literal("inherited-debt"),
  source: recordedTextSchema,
  decision: recordedTextSchema,
});

const authorisedLocationFields = {
  kind: z.literal("authorised-location"),
  clause: z.string(),
  file: z.string(),
  reason: z.string(),
};

type UnjudgedWhyChain = NonNullable<unknown> | null;

type Unjudged<Entry> = Entry extends { readonly whyChain: RecordedWhyChain }
  ? Omit<Entry, "whyChain"> & { readonly whyChain: UnjudgedWhyChain }
  : Entry;

const unjudgedWhyChainSchema = z.custom<UnjudgedWhyChain>((whyChain) => whyChain !== undefined);

const reasonOnlyFields = {
  reason: recordedTextSchema,
  whyChain: z.never().optional(),
  provenance: z.never().optional(),
};

const chainedAuthorisedLocationSchema = z.strictObject({
  ...authorisedLocationFields,
  whyChain: unjudgedWhyChainSchema,
  provenance: existingAuthorisationProvenanceSchema.optional(),
});

const importedAuthorisedLocationSchema = z.strictObject({
  ...authorisedLocationFields,
  whyChain: z.never().optional(),
  provenance: existingAuthorisationProvenanceSchema,
});

const reasonedAuthorisedLocationSchema = z.strictObject({
  ...authorisedLocationFields,
  ...reasonOnlyFields,
});

const fileCarveOutFields = {
  kind: z.literal("file-carve-out"),
  clause: z.string(),
  file: z.string(),
  reason: z.string().optional(),
};

const chainedFileCarveOutSchema = z.strictObject({
  ...fileCarveOutFields,
  whyChain: unjudgedWhyChainSchema,
  provenance: inheritedDebtProvenanceSchema.optional(),
});

const importedFileCarveOutSchema = z.strictObject({
  ...fileCarveOutFields,
  whyChain: z.never().optional(),
  provenance: inheritedDebtProvenanceSchema,
});

const plainFileCarveOutSchema = z.strictObject({
  ...fileCarveOutFields,
  whyChain: z.never().optional(),
  provenance: z.never().optional(),
});

type FileEvidenceSchemas = {
  readonly "authorised-location": z.ZodType<Unjudged<AuthorisedLocationEntry>>;
  readonly "file-carve-out": z.ZodType<Unjudged<FileCarveOutEntry>>;
};

const FILE_EVIDENCE_SCHEMAS_OF: Readonly<Record<FileExceptionWhyChains, FileEvidenceSchemas>> = {
  required: {
    "authorised-location": z.union([
      chainedAuthorisedLocationSchema,
      importedAuthorisedLocationSchema,
    ]),
    "file-carve-out": z.union([
      chainedFileCarveOutSchema,
      importedFileCarveOutSchema,
      plainFileCarveOutSchema,
    ]),
  },
  optional: {
    "authorised-location": z.union([
      chainedAuthorisedLocationSchema,
      importedAuthorisedLocationSchema,
      reasonedAuthorisedLocationSchema,
    ]),
    "file-carve-out": z.union([
      chainedFileCarveOutSchema,
      importedFileCarveOutSchema,
      plainFileCarveOutSchema,
    ]),
  },
};

const legacySourceOf = (request: {
  readonly source: string;
}): LegacySource | "not-legacy-source" => {
  const groups = legacySourceGroupsSchema.safeParse(LEGACY_SOURCE.exec(request.source)?.groups);
  if (!groups.success) {
    return "not-legacy-source";
  }
  const path = repoPathSchema.safeParse(`${groups.data.directory}/${groups.data.stem}.json`);
  return path.success
    ? {
        path: path.data,
        directory: groups.data.directory,
        discipline: groups.data.stem.toUpperCase(),
        index: groups.data.index,
      }
    : "not-legacy-source";
};

type ImportedIdentity = {
  readonly kind: "authorised-location" | "file-carve-out";
  readonly clause: string;
  readonly file: RepoPath;
};

type Repointing = (request: { readonly text: string }) => string;

const sameEntry = (request: {
  readonly atBase: StructuralExceptionEntry;
  readonly atHead: StructuralExceptionEntry;
  readonly repointed: Repointing;
}): "same" | "different" =>
  JSON.stringify(request.atBase, (_key, value: unknown) =>
    typeof value === "string" ? request.repointed({ text: value }) : value,
  ) === JSON.stringify(request.atHead)
    ? "same"
    : "different";

const sameIdentity = (request: {
  readonly atBase: StructuralExceptionEntry;
  readonly identity: ImportedIdentity;
  readonly repointed: Repointing;
}): "same" | "different" =>
  request.atBase.kind === request.identity.kind &&
  request.atBase.clause === request.identity.clause &&
  request.repointed({ text: request.atBase.file }) === request.identity.file
    ? "same"
    : "different";

const legacyListing = (request: {
  readonly sourceTextsAtBase: ReadonlyMap<RepoPath, string>;
  readonly source: LegacySource;
  readonly file: RepoPath;
}): "listed" | "not-listed" => {
  const text = request.sourceTextsAtBase.get(request.source.path);
  const document = text === undefined ? undefined : parsedJson({ text });
  if (document === undefined || document.outcome === "failed") {
    return "not-listed";
  }
  const records = legacyRecordsSchema.safeParse(document.value);
  return records.success &&
    records.data[request.source.index]?.files.includes(request.file) === true
    ? "listed"
    : "not-listed";
};

const IMPORT_WAY_OUT: Readonly<Record<ImportedIdentity["kind"], string>> = {
  "authorised-location": "give it a whyChain",
  "file-carve-out": "give it a whyChain, or remove its provenance to keep it as debt",
};

const importRefused = (request: {
  readonly detail: string;
  readonly kind: ImportedIdentity["kind"];
}): Result<never, EntryProblem> => ({
  outcome: "failed",
  error: {
    kind: "import-unverified",
    detail: `${request.detail}: ${IMPORT_WAY_OUT[request.kind]}`,
  },
});

const REGULAR_EXPRESSION_SYNTAX = /[.*+?^${}()|[\]\\]/g;

const PATH_CHARACTER_BESIDES_DOT = "[\\p{L}\\p{N}\\p{M}_\\/\\-+~@＿／－＋～＠．]";

const PATH_CHARACTER = `(?:${PATH_CHARACTER_BESIDES_DOT}|\\.)`;

const NOT_INSIDE_A_LONGER_PATH_BEFORE = `(?<!${PATH_CHARACTER})`;

const NOT_INSIDE_A_LONGER_PATH_AFTER = `(?!${PATH_CHARACTER_BESIDES_DOT}|\\.${PATH_CHARACTER})`;

const AS_RECORDED: Repointing = ({ text }) => text;

const repointingOf = (request: { readonly baseline: MeasuredBaseline }): Repointing => {
  const headPathOf = new Map<string, RepoPath>(
    [...request.baseline.basePathOfRenamed].map(([headPath, basePath]) => [basePath, headPath]),
  );
  if (headPathOf.size === 0) {
    return AS_RECORDED;
  }
  const longestFirst = [...headPathOf.keys()].sort((left, right) => right.length - left.length);
  const basePaths = new RegExp(
    `${NOT_INSIDE_A_LONGER_PATH_BEFORE}(?:${longestFirst.map((path) => path.replace(REGULAR_EXPRESSION_SYNTAX, "\\$&")).join("|")})${NOT_INSIDE_A_LONGER_PATH_AFTER}`,
    "gu",
  );
  return ({ text }) => text.replace(basePaths, (basePath) => headPathOf.get(basePath) ?? basePath);
};

const baseFormsOf = (request: { readonly baseline: MeasuredBaseline }): readonly Repointing[] => [
  AS_RECORDED,
  repointingOf(request),
];

const heldAtBase = (request: {
  readonly entry: StructuralExceptionEntry;
  readonly baseline: MeasuredBaseline;
}): "held" | "not-held" => {
  const forms = baseFormsOf(request);
  return request.baseline.entriesAtBase.some((atBase) =>
    forms.some((repointed) => sameEntry({ atBase, atHead: request.entry, repointed }) === "same"),
  )
    ? "held"
    : "not-held";
};

const importAgainstBase = <ImportedRecord>(request: {
  readonly record: ImportedRecord;
  readonly entry: StructuralExceptionEntry;
  readonly identity: ImportedIdentity;
  readonly discipline: string;
  readonly provenance: { readonly kind: ImportProvenanceKind; readonly source: string };
  readonly baseline: MeasuredBaseline;
}): Result<ImportedRecord, EntryProblem> => {
  const { baseline } = request;
  if (heldAtBase({ entry: request.entry, baseline }) === "held") {
    return { outcome: "ok", value: request.record };
  }
  const forms = baseFormsOf({ baseline });
  if (
    baseline.entriesAtBase.some((atBase) =>
      forms.some(
        (repointed) => sameIdentity({ atBase, identity: request.identity, repointed }) === "same",
      ),
    )
  ) {
    return importRefused({
      detail: "the imported record was edited since the base revision",
      kind: request.identity.kind,
    });
  }
  const fileAtBase = basePathOf({
    file: request.identity.file,
    basePathOfRenamed: baseline.basePathOfRenamed,
  });
  const source = legacySourceOf({ source: request.provenance.source });
  const listed =
    source !== "not-legacy-source" &&
    source.directory === LEGACY_DIRECTORY_OF[request.provenance.kind] &&
    source.discipline === request.discipline.toUpperCase() &&
    legacyListing({ sourceTextsAtBase: baseline.sourceTextsAtBase, source, file: fileAtBase }) ===
      "listed";
  return listed
    ? { outcome: "ok", value: request.record }
    : importRefused({
        kind: request.identity.kind,
        detail: `the record is new since the base revision, and its provenance source ${request.provenance.source} is not an entry at the base revision listing ${fileAtBase} under ${LEGACY_DIRECTORY_OF[request.provenance.kind]}/${request.discipline.toLowerCase()}.json`,
      });
};

const verifiedImport = <ImportedRecord>(request: {
  readonly record: ImportedRecord;
  readonly entry: StructuralExceptionEntry;
  readonly identity: ImportedIdentity;
  readonly discipline: string;
  readonly provenance: { readonly kind: ImportProvenanceKind; readonly source: string };
  readonly baseline: ExceptionBaseline;
}): Result<ImportedRecord, EntryProblem> =>
  judgedAtBase({
    evidence: { provenance: request.provenance },
    baseline: request.baseline,
    inFull: () => ({ outcome: "ok", value: request.record }),
    unjudged: () => ({ outcome: "ok", value: request.record }),
    againstBase: (base) => importAgainstBase({ ...request, baseline: base }),
  });

const recordedFile = (request: { readonly file: string }): Result<RepoPath, EntryProblem> => {
  const parsed = repoPathSchema.safeParse(request.file);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : { outcome: "failed", error: { kind: "file-not-repo-path", file: request.file } };
};

const LEGACY_CHAIN_NEW_OR_EDITED = `a new or edited entry's whyChain follows the causal contract (docs/why-chain-contract.md in the ${TOOL_IDENTITY.packageName} package); a chain without rootCheck and readback is accepted only while --base-revision holds its entry unchanged`;

const chainRefused = (request: { readonly detail: string }): Result<never, EntryProblem> => ({
  outcome: "failed",
  error: { kind: "why-chain-refused", detail: request.detail },
});

const causalChainOf = (request: {
  readonly whyChain: unknown;
  readonly preface: readonly string[];
}): Result<RecordedWhyChain, EntryProblem> => {
  const parsed = versionOneWhyChainSchema.safeParse(request.whyChain);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : chainRefused({ detail: [...request.preface, z.prettifyError(parsed.error)].join("\n") });
};

const legacyChainOf = (request: {
  readonly whyChain: unknown;
}): Result<RecordedWhyChain, EntryProblem> => {
  const parsed = legacyWhyChainSchema.safeParse(request.whyChain);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : chainRefused({ detail: z.prettifyError(parsed.error) });
};

const judgedWhyChain = (request: {
  readonly whyChain: unknown;
  readonly entry: StructuralExceptionEntry;
  readonly baseline: ExceptionBaseline;
}): Result<RecordedWhyChain, EntryProblem> =>
  judgedAtBase({
    evidence: { whyChain: request.whyChain },
    baseline: request.baseline,
    inFull: () => causalChainOf({ whyChain: request.whyChain, preface: [] }),
    unjudged: () => legacyChainOf(request),
    againstBase: (base) =>
      heldAtBase({ entry: request.entry, baseline: base }) === "held"
        ? legacyChainOf(request)
        : causalChainOf({ whyChain: request.whyChain, preface: [LEGACY_CHAIN_NEW_OR_EDITED] }),
  });

type ClauseSelection = { readonly clause: ClauseAddress; readonly mechanism: EngineId };

const unselectedKindOf = (request: {
  readonly selection: Selection;
  readonly clause: ClauseAddress;
}): "clause-not-adopted" | "clause-not-run" | "clause-not-selected" =>
  (
    [
      ["clause-not-adopted", request.selection.notAdopted],
      ["clause-not-run", request.selection.notRun],
    ] as const
  ).find(([, addresses]) =>
    addresses.some(
      (address) => sameClauseAddress({ left: address, right: request.clause }) === "same",
    ),
  )?.[0] ?? "clause-not-selected";

const selectedClauseOf = (request: {
  readonly entry: StructuralExceptionEntry;
  readonly selection: Selection;
}): Result<ClauseSelection, EntryProblem> => {
  const address = clauseAddressSchema.safeParse(request.entry.clause);
  if (!address.success) {
    return {
      outcome: "failed",
      error: { kind: "clause-unparseable", detail: z.prettifyError(address.error) },
    };
  }
  const clause = address.data;
  const selected = request.selection.selected.find(
    (candidate) => sameClauseAddress({ left: candidate.address, right: clause }) === "same",
  );
  if (selected === undefined) {
    return {
      outcome: "failed",
      error: { kind: unselectedKindOf({ selection: request.selection, clause }), clause },
    };
  }
  if (selected.exceptions === "refused") {
    return { outcome: "failed", error: { kind: "non-exemptible-clause", clause } };
  }
  return { outcome: "ok", value: { clause, mechanism: selected.mechanism } };
};

const fileRecordOf = (request: {
  readonly evidence: Unjudged<AuthorisedLocationEntry> | Unjudged<FileCarveOutEntry>;
  readonly entry: StructuralExceptionEntry;
  readonly clause: ClauseAddress;
  readonly mechanism: EngineId;
  readonly file: RepoPath;
  readonly baseline: ExceptionBaseline;
}): Result<ExceptionRecord, EntryProblem> => {
  const { evidence, entry, clause, mechanism, file, baseline } = request;
  if (evidence.whyChain !== undefined) {
    const whyChain = judgedWhyChain({ whyChain: evidence.whyChain, entry, baseline });
    return whyChain.outcome === "failed"
      ? whyChain
      : {
          outcome: "ok",
          value: { ...evidence, whyChain: whyChain.value, clause, mechanism, file },
        };
  }
  if (evidence.provenance === undefined) {
    return { outcome: "ok", value: { ...evidence, clause, mechanism, file } };
  }
  return verifiedImport({
    record: { ...evidence, clause, mechanism, file },
    entry,
    identity: { kind: evidence.kind, clause: evidence.clause, file },
    discipline: clause.discipline,
    provenance: evidence.provenance,
    baseline,
  });
};

const parsedRecord = (request: {
  readonly entry: StructuralExceptionEntry;
  readonly selection: Selection;
  readonly baseline: ExceptionBaseline;
  readonly fileEvidence: FileEvidenceSchemas;
}): Result<ExceptionRecord, EntryProblem> => {
  const { entry } = request;
  const selected = selectedClauseOf(request);
  if (selected.outcome === "failed") {
    return selected;
  }
  const { clause, mechanism } = selected.value;
  switch (entry.kind) {
    case "authorised-location": {
      const file = recordedFile({ file: entry.file });
      if (file.outcome === "failed") {
        return file;
      }
      const evidence = request.fileEvidence["authorised-location"].safeParse(entry);
      return evidence.success
        ? fileRecordOf({
            evidence: evidence.data,
            entry,
            clause,
            mechanism,
            file: file.value,
            baseline: request.baseline,
          })
        : {
            outcome: "failed",
            error: { kind: "evidence-refused", detail: z.prettifyError(evidence.error) },
          };
    }
    case "file-carve-out": {
      const file = recordedFile({ file: entry.file });
      if (file.outcome === "failed") {
        return file;
      }
      const evidence = request.fileEvidence["file-carve-out"].safeParse(entry);
      return evidence.success
        ? fileRecordOf({
            evidence: evidence.data,
            entry,
            clause,
            mechanism,
            file: file.value,
            baseline: request.baseline,
          })
        : {
            outcome: "failed",
            error: { kind: "evidence-refused", detail: z.prettifyError(evidence.error) },
          };
    }
    case "clause-wide-carve-out": {
      const whyChain = judgedWhyChain({
        whyChain: entry.whyChain,
        entry,
        baseline: request.baseline,
      });
      if (whyChain.outcome === "failed") {
        return whyChain;
      }
      return {
        outcome: "ok",
        value: {
          kind: entry.kind,
          clause,
          mechanism,
          reason: entry.reason,
          whyChain: whyChain.value,
        },
      };
    }
  }
};

type IdentityComparison = "same-identity" | "different-identity";

const identityComparison = (request: {
  readonly left: ExceptionRecord;
  readonly right: ExceptionRecord;
}): IdentityComparison => {
  const { left, right } = request;
  if (
    left.kind !== right.kind ||
    sameClauseAddress({ left: left.clause, right: right.clause }) === "different"
  ) {
    return "different-identity";
  }
  switch (left.kind) {
    case "clause-wide-carve-out":
      return "same-identity";
    case "authorised-location":
    case "file-carve-out":
      return right.kind !== "clause-wide-carve-out" && left.file === right.file
        ? "same-identity"
        : "different-identity";
  }
};

const originalRecordOf = (request: {
  readonly valid: readonly IndexedRecord[];
  readonly candidate: IndexedRecord;
}): IndexedRecord | undefined =>
  request.valid.find(
    (earlier) =>
      earlier.index < request.candidate.index &&
      identityComparison({ left: earlier.record, right: request.candidate.record }) ===
        "same-identity",
  );

type ParsedEntry = {
  readonly index: number;
  readonly place: RecordPlace;
  readonly record: Result<ExceptionRecord, EntryProblem>;
};

const validRecordsOf = (request: {
  readonly parsed: readonly ParsedEntry[];
}): readonly IndexedRecord[] =>
  request.parsed.flatMap(({ index, place, record }): readonly IndexedRecord[] =>
    record.outcome === "ok" ? [{ index, place, record: record.value }] : [],
  );

const invalidRecordOf = (request: {
  readonly entry: ParsedEntry;
  readonly valid: readonly IndexedRecord[];
}): readonly InvalidRecord[] => {
  const { index, place, record } = request.entry;
  if (record.outcome === "failed") {
    return [{ place, problem: record.error }];
  }
  const original = originalRecordOf({
    valid: request.valid,
    candidate: { index, place, record: record.value },
  });
  if (original === undefined) {
    return [];
  }
  return [{ place, problem: { kind: "duplicate", of: original.place } }];
};

const invalidRecordsOf = (request: {
  readonly parsed: readonly ParsedEntry[];
  readonly valid: readonly IndexedRecord[];
}): readonly InvalidRecord[] =>
  request.parsed.flatMap((entry) => invalidRecordOf({ entry, valid: request.valid }));

const firstRecordsOf = (request: {
  readonly valid: readonly IndexedRecord[];
}): readonly ExceptionRecord[] =>
  request.valid
    .filter((candidate) => originalRecordOf({ valid: request.valid, candidate }) === undefined)
    .map(({ record }) => record);

export const parseExceptionEntries = (request: {
  readonly entries: readonly PlacedEntry[];
  readonly selection: Selection;
  readonly baseline: ExceptionBaseline;
  readonly fileExceptionWhyChains: FileExceptionWhyChains;
}): ExceptionReading => {
  const fileEvidence = FILE_EVIDENCE_SCHEMAS_OF[request.fileExceptionWhyChains];
  const parsed = request.entries.map(({ place, entry }, index): ParsedEntry => ({
    index,
    place,
    record: parsedRecord({
      entry,
      selection: request.selection,
      baseline: request.baseline,
      fileEvidence,
    }),
  }));
  const valid = validRecordsOf({ parsed });
  return { records: firstRecordsOf({ valid }), invalid: invalidRecordsOf({ parsed, valid }) };
};

const importedEvidenceOf = (request: { readonly entry: StructuralExceptionEntry }) => {
  switch (request.entry.kind) {
    case "authorised-location":
      return importedAuthorisedLocationSchema.safeParse(request.entry);
    case "file-carve-out":
      return importedFileCarveOutSchema.safeParse(request.entry);
    case "clause-wide-carve-out":
      return undefined;
  }
};

const importEvidenceOf = (request: {
  readonly entry: StructuralExceptionEntry;
}): ImportEvidence => {
  const evidence = importedEvidenceOf(request);
  if (evidence === undefined || !evidence.success) {
    return { imported: "no" };
  }
  return { imported: "yes", source: evidence.data.provenance.source };
};

const importSourcePathsOf = (request: {
  readonly entry: StructuralExceptionEntry;
}): readonly RepoPath[] => {
  const evidence = importEvidenceOf(request);
  if (evidence.imported === "no") {
    return [];
  }
  const source = legacySourceOf({ source: evidence.source });
  return source === "not-legacy-source" ? [] : [source.path];
};

export const importedEntriesIn = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}): "present" | "absent" =>
  request.entries.some((entry) => importEvidenceOf({ entry }).imported === "yes")
    ? "present"
    : "absent";

export const importSourcesOf = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}): readonly RepoPath[] => [
  ...new Set(request.entries.flatMap((entry) => importSourcePathsOf({ entry }))),
];

export const exceptionEntriesOfText = (request: {
  readonly text: string;
}): readonly StructuralExceptionEntry[] => {
  const document = parsedJson({ text: request.text });
  if (document.outcome === "failed") {
    return [];
  }
  const entries = exceptionEntriesOfDocument({ document: document.value });
  return entries.outcome === "ok" ? entries.value : [];
};

export const exceptionEntryParser: ExceptionEntryParser = {
  parseExceptionEntries,
  importedEntriesIn,
  importSourcesOf,
};

const SINGLE_FILE_RECORDS = repoPathOf("discipline-exceptions.json");

export const placedInSingleFile = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}): readonly PlacedEntry[] =>
  request.entries.map((entry, index) => ({
    place: { layout: "single-file", file: SINGLE_FILE_RECORDS, index },
    entry,
  }));
