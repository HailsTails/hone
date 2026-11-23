import { z } from "zod";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type {
  TeamDefinition,
  TeamDefinitionAddress,
} from "../../../application/ports/upgrade/version-one-team-layout.ts";
import {
  checkAddressOfNames,
  checkNamesOf,
  type CheckNames,
} from "../../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { Result } from "../../../domain/result.ts";
import { parsedJson } from "../../content-files/parsed-json.ts";
import {
  caseWireSchema,
  catalogueFileSchema,
  catalogueNameSchema,
  symptomWireSchema,
} from "../../content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { clauseIdSchema, disciplineIdSchema } from "../../hone-config-file/identifiers.ts";

export const VERSION_TWO_NAMES_FILE = "version-two-names.json";

export type ClauseName = { readonly check: CheckNames; readonly title: string };

export type VersionTwoNames = {
  readonly clauses: ReadonlyMap<string, ClauseName>;
  readonly definitions: readonly TeamDefinition[];
};

const NO_NAMES: VersionTwoNames = { clauses: new Map(), definitions: [] };

const CLAUSE_SEPARATOR = "#";

const isTeamClauseText = (text: string): boolean => {
  const [discipline, clause, trailing] = text.split(CLAUSE_SEPARATOR);
  return (
    trailing === undefined &&
    disciplineIdSchema.safeParse(discipline).success &&
    clauseIdSchema.safeParse(clause).success
  );
};

const checkNamesSchema = z.string().transform((text, context): CheckNames => {
  const names = checkNamesOf({ text });
  if (names !== undefined) {
    return names;
  }
  context.addIssue({ code: "custom", message: `${text} is not a check address <symptom>#<check>` });
  return z.NEVER;
});

const clausesSchema = z
  .record(z.string(), z.strictObject({ check: checkNamesSchema, title: z.string().min(1) }))
  .superRefine((clauses, context) => {
    Object.keys(clauses)
      .filter((clause) => !isTeamClauseText(clause))
      .forEach((clause) => {
        context.addIssue({
          code: "custom",
          message: `${clause} is not a clause of the form <ID>#<clause>`,
        });
      });
    const checks = Object.values(clauses).map(({ check }) => checkAddressOfNames(check));
    [...new Set(checks.filter((check, index) => checks.indexOf(check) !== index))].forEach(
      (check) => {
        context.addIssue({ code: "custom", message: `${check} names more than one clause` });
      },
    );
  });

const NAME_OMITTED = { name: true } as const;

const versionTwoNamesSchema = z.strictObject({
  clauses: clausesSchema,
  symptoms: z.record(catalogueNameSchema, symptomWireSchema.omit({ ...NAME_OMITTED, seen: true })),
  cases: z.record(catalogueNameSchema, caseWireSchema.omit(NAME_OMITTED)),
  principles: z.record(
    catalogueNameSchema,
    catalogueFileSchema.shape.principles.element.omit(NAME_OMITTED),
  ),
  rules: z.record(catalogueNameSchema, catalogueFileSchema.shape.rules.element.omit(NAME_OMITTED)),
});

type VersionTwoNamesFile = z.output<typeof versionTwoNamesSchema>;

type Pointed = VersionTwoNamesFile["cases"][string]["owes"][number];

const pointedAddressOf = (point: Pointed): TeamDefinitionAddress =>
  "rule" in point
    ? { kind: "rule", name: point.rule }
    : { kind: "principle", name: point.principle };

const definitionsOf = (file: VersionTwoNamesFile): readonly TeamDefinition[] => [
  ...Object.entries(file.principles).map(([name, { title, ...facts }]): TeamDefinition => ({
    kind: "principle",
    name,
    title,
    facts,
    refers: [],
  })),
  ...Object.entries(file.rules).map(([name, { title, ...facts }]): TeamDefinition => ({
    kind: "rule",
    name,
    title,
    facts,
    refers: [{ kind: "principle", name: facts.principle }],
  })),
  ...Object.entries(file.cases).map(([name, { title, ...facts }]): TeamDefinition => ({
    kind: "case",
    name,
    title,
    facts,
    refers: facts.owes.map(pointedAddressOf),
  })),
  ...Object.entries(file.symptoms).map(([name, { title, ...facts }]): TeamDefinition => ({
    kind: "symptom",
    name,
    title,
    facts,
    refers: facts.mayIndicate.flatMap((indication): readonly TeamDefinitionAddress[] => [
      { kind: "case", name: indication.case },
      ...indication.points.map(pointedAddressOf),
    ]),
  })),
];

export const readVersionTwoNames = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<VersionTwoNames, VersionTwoLoadFailure> => {
  const { path } = request;
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: NO_NAMES };
  }
  const text = request.fileText.read({ path });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path, detail: text.error.detail },
    };
  }
  const document = parsedJson({ text: text.value });
  if (document.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-malformed", path, detail: document.error } };
  }
  const names = versionTwoNamesSchema.safeParse(document.value);
  return names.success
    ? {
        outcome: "ok",
        value: {
          clauses: new Map(Object.entries(names.data.clauses)),
          definitions: definitionsOf(names.data),
        },
      }
    : {
        outcome: "failed",
        error: { kind: "file-malformed", path, detail: z.prettifyError(names.error) },
      };
};
