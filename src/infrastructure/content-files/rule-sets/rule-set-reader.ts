import { z } from "zod";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { RuleSetFiles } from "../../../application/ports/rule-set/rule-set-files.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { clauseEditionsSchema, editionSchema } from "../edition.ts";
import { clauseIdSchema, disciplineIdSchema, mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import type { DisciplineId, MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import { JSON_KIND_NAMES, jsonKindOf, sameJsonValue } from "../../../domain/settings/json-values/json-kind.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { parsedJson } from "../parsed-json.ts";
import type { Result } from "../../../domain/result.ts";
import type { DeepReadonly, Equal } from "../../engines/protocol/runner-module/type-equality.ts";
import type { AuthoredDisciplineFile, AuthoredPieceFile, AuthoredSourceCase } from "../../../domain/rule-set/authored-rule-set-types.ts";
import type { DisciplineFile, PieceFile, SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import { pieceFolderSegmentsOf } from "../../../domain/rule-set/piece-folder.ts";
import { RESERVED_EDITION_SETTING } from "../../../domain/settings/clause-settings/reserved-edition-setting.ts";

const SUPPORTED_VERSION = 1;

export { parsedJson } from "../parsed-json.ts";

export const readVersionOneJson = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<unknown, VersionTwoLoadFailure> => {
  const text = request.fileText.read({ path: request.path });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: request.path, detail: text.error.detail },
    };
  }
  const parsed = parsedJson({ text: text.value });
  if (parsed.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-malformed", path: request.path, detail: parsed.error },
    };
  }
  const document = parsed.value;
  if (
    typeof document === "object" &&
    document !== null &&
    "version" in document &&
    document.version !== SUPPORTED_VERSION
  ) {
    return {
      outcome: "failed",
      error: { kind: "unsupported-version", path: request.path, found: document.version },
    };
  }
  return { outcome: "ok", value: document };
};

const entryCount = (entries: readonly unknown[]): "empty" | "some" =>
  entries.length > 0 ? "some" : "empty";

const textDistinctness = (texts: readonly string[]): "distinct" | "repeated" =>
  new Set(texts).size === texts.length ? "distinct" : "repeated";

const sourceCaseSchema = z.object({
  name: z.string(),
  fileName: repoPathSchema,
  source: z.string(),
  expectedLines: z.array(z.number()),
  edition: editionSchema.optional(),
});

const flagCaseSchema = sourceCaseSchema.refine(
  (sourceCase) => entryCount(sourceCase.expectedLines) === "some",
  { error: "a flag case names no expected line" },
);

const allowCaseSchema = sourceCaseSchema.refine(
  (sourceCase) => entryCount(sourceCase.expectedLines) === "empty",
  { error: "an allow case names expected lines" },
);

const anchorKindSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keyword"), keyword: z.string() }),
  z.object({ kind: z.literal("file") }),
]);

const ruleSetMechanismSchema = z.string().transform((text, context): MechanismId => {
  const parsed = mechanismIdSchema.safeParse(text);
  if (parsed.success) {
    return parsed.data;
  }
  context.addIssue({ code: "custom", message: `not a mechanism: expected one of ${mechanismIdSchema.options.join(", ")}` });
  return z.NEVER;
});

const clauseDefinitionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mechanical"),
    id: clauseIdSchema,
    summary: z.string(),
    mechanisms: z
      .array(ruleSetMechanismSchema)
      .refine((entries) => entryCount(entries) === "some", { error: "a mechanical clause names no mechanism" }),
    anchor: anchorKindSchema,
    exceptions: z.enum(["allowed", "refused"]).default("allowed"),
    cases: z.object({
      flag: z
        .array(flagCaseSchema)
        .refine((entries) => entryCount(entries) === "some", { error: "a mechanical clause has no flag case" }),
      allow: z
        .array(allowCaseSchema)
        .refine((entries) => entryCount(entries) === "some", { error: "a mechanical clause has no allow case" }),
    }),
  }),
  z.object({
    kind: z.literal("judgement"),
    id: clauseIdSchema,
    summary: z.string(),
    enforcedBy: z.literal("review"),
  }),
]);

const disciplineFileSchema = z.object({
  version: z.literal(SUPPORTED_VERSION),
  id: disciplineIdSchema,
  clauses: z
    .array(clauseDefinitionSchema)
    .refine((clauses) => textDistinctness(clauses.map((clause) => clause.id)) === "distinct", {
      error: "two clauses share an id",
    }),
});

const clauseSettingDeclarationSchema = z
  .strictObject({
    default: z.json(),
    choices: z.array(z.json()).min(1).optional(),
  })
  .superRefine((declaration, context) => {
    if (declaration.choices === undefined) return;
    const defaultKind = jsonKindOf({ value: declaration.default });
    if (declaration.choices.some((choice) => jsonKindOf({ value: choice }) !== defaultKind)) {
      context.addIssue({ code: "custom", path: ["choices"], message: `every choice must be ${JSON_KIND_NAMES[defaultKind]}, as the default is` });
    }
    if (!declaration.choices.some((choice) => sameJsonValue({ left: choice, right: declaration.default }) === "same")) {
      context.addIssue({ code: "custom", path: ["default"], message: "the default must be one of the choices" });
    }
  });

const pieceFileSchema = z.object({
  version: z.literal(SUPPORTED_VERSION),
  discipline: disciplineIdSchema,
  mechanism: ruleSetMechanismSchema,
  clauses: z
    .array(
      z.object({
        clause: clauseIdSchema,
        settings: z.unknown(),
        clauseSettings: z
          .record(z.string().min(1), clauseSettingDeclarationSchema)
          .default({})
          .refine((declarations) => !Object.hasOwn(declarations, RESERVED_EDITION_SETTING), {
            error: `${RESERVED_EDITION_SETTING} is reserved for the clause's editions; declare them under editions`,
          }),
        editions: clauseEditionsSchema,
      }),
    )
    .refine((entries) => textDistinctness(entries.map((entry) => entry.clause)) === "distinct", {
      error: "two entries name the same clause",
    }),
});

export const isSourceCaseSchemaEqual: Equal<DeepReadonly<z.output<typeof sourceCaseSchema>>, SourceCase> = true;

export const isDisciplineFileSchemaEqual: Equal<DeepReadonly<z.output<typeof disciplineFileSchema>>, DisciplineFile> = true;

export const isPieceFileSchemaEqual: Equal<DeepReadonly<z.output<typeof pieceFileSchema>>, PieceFile> = true;

export const isAuthoredSourceCaseSchemaEqual: Equal<DeepReadonly<z.input<typeof sourceCaseSchema>>, AuthoredSourceCase> = true;

export const isAuthoredDisciplineFileSchemaEqual: Equal<DeepReadonly<z.input<typeof disciplineFileSchema>>, AuthoredDisciplineFile> = true;

export const isAuthoredPieceFileSchemaEqual: Equal<DeepReadonly<z.input<typeof pieceFileSchema>>, AuthoredPieceFile> = true;

const isContentRefusal = (
  issue: z.core.$ZodIssue,
): issue is z.core.$ZodIssueCustom => issue.code === "custom";

const schemaRefusal = (request: {
  readonly path: string;
  readonly error: z.ZodError;
}): VersionTwoLoadFailure => {
  const detail = z.prettifyError(request.error);
  return request.error.issues.every(isContentRefusal)
    ? { kind: "rule-set-invalid", path: request.path, detail }
    : { kind: "file-malformed", path: request.path, detail };
};

const ruleSetInvalid = (request: {
  readonly path: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: VersionTwoLoadFailure } => ({
  outcome: "failed",
  error: { kind: "rule-set-invalid", path: request.path, detail: request.detail },
});

export const disciplineFilePath = (request: {
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly discipline: DisciplineId;
}): string =>
  request.path.join({
    segments: [request.ruleSetRoot, "rules", request.discipline, "discipline.json"],
  });

export const pieceFilePath = (request: {
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly mechanism: MechanismId;
  readonly discipline: DisciplineId;
}): string =>
  request.path.join({ segments: [...pieceFolderSegmentsOf(request), "piece.json"] });

export const readDisciplineFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly discipline: DisciplineId;
}): Result<DisciplineFile, VersionTwoLoadFailure> => {
  const path = disciplineFilePath(request);
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = disciplineFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return { outcome: "failed", error: schemaRefusal({ path, error: parsed.error }) };
  }
  if (parsed.data.id !== request.discipline) {
    return ruleSetInvalid({
      path,
      detail: `id ${parsed.data.id} differs from its folder name ${request.discipline}`,
    });
  }
  return { outcome: "ok", value: parsed.data };
};

type MechanicalDefinition = Extract<DisciplineFile["clauses"][number], { readonly kind: "mechanical" }>;

const undeclaredCaseEditionOf = (request: {
  readonly piece: PieceFile;
  readonly discipline: DisciplineFile;
}): string | undefined =>
  request.piece.clauses
    .flatMap((entry) => {
      const definition = request.discipline.clauses.find(
        (clause): clause is MechanicalDefinition => clause.id === entry.clause && clause.kind === "mechanical",
      );
      const cases = definition === undefined ? [] : [...definition.cases.flag, ...definition.cases.allow];
      return cases.flatMap((sourceCase) =>
        sourceCase.edition === undefined || entry.editions.declared.includes(sourceCase.edition)
          ? []
          : [
              `case ${sourceCase.name} of clause ${entry.clause} runs under edition ${sourceCase.edition}, which this piece does not declare; it declares ${entry.editions.declared.join(", ")}`,
            ],
      );
    })
    .at(0);

export const readPieceFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly mechanism: MechanismId;
  readonly discipline: DisciplineFile;
}): Result<PieceFile, VersionTwoLoadFailure> => {
  const path = pieceFilePath({
    path: request.path,
    ruleSetRoot: request.ruleSetRoot,
    installRoot: request.installRoot,
    mechanism: request.mechanism,
    discipline: request.discipline.id,
  });
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = pieceFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return { outcome: "failed", error: schemaRefusal({ path, error: parsed.error }) };
  }
  const piece = parsed.data;
  if (piece.discipline !== request.discipline.id) {
    return ruleSetInvalid({
      path,
      detail: `discipline ${piece.discipline} differs from its folder name ${request.discipline.id}`,
    });
  }
  if (piece.mechanism !== request.mechanism) {
    return ruleSetInvalid({
      path,
      detail: `mechanism ${piece.mechanism} differs from its folder name ${request.mechanism}`,
    });
  }
  const declared = request.discipline.clauses.map((clause) => clause.id);
  const undeclared = piece.clauses.find((entry) => !declared.includes(entry.clause));
  if (undeclared !== undefined) {
    return ruleSetInvalid({
      path,
      detail: `clause ${undeclared.clause} is not declared by discipline ${request.discipline.id}`,
    });
  }
  const unsupported = undeclaredCaseEditionOf({ piece, discipline: request.discipline });
  if (unsupported !== undefined) {
    return ruleSetInvalid({ path, detail: unsupported });
  }
  return { outcome: "ok", value: piece };
};

export const createRuleSetFileReader = (options: { readonly fileText: FileTextPort; readonly path: PathPort }): RuleSetFiles => ({
  disciplineFile: (request) => readDisciplineFile({ ...options, ...request }),
  pieceFile: (request) => readPieceFile({ ...options, ...request }),
});
