import { z } from "zod";

import type {
  CaseVerdict,
  Hit,
  MeasuredPair,
  ProjectionWrite,
} from "../../../../domain/runner/runner-result-types.ts";
import { clauseAddressObjectSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { anchorSchema } from "./anchor-schema.ts";
import { runnerFailureSchema } from "./runner-failure-schema.ts";
import { snippetSchema } from "./snippet.ts";
import type { DeepReadonly, Equal } from "./type-equality.ts";

export const reportedCheckSchema = z.string().min(1);

export const nativeExceptionKindSchema = z.enum([
  "ignore",
  "config-override",
  "suppression-entry",
  "inline-disable",
  "inline-rule-config",
  "command-line-option",
]);

const PAGE_SECTION = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PAGE_UNDER_ITS_FOLDER =
  /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.md$/;

export const remedySchema = z
  .object({
    fix: z.string().min(1),
    page: z.string().regex(PAGE_UNDER_ITS_FOLDER),
    section: z.string().regex(PAGE_SECTION),
  })
  .readonly();

export const hitSchema = z
  .object({
    clause: clauseAddressObjectSchema,
    file: repoPathSchema,
    anchor: anchorSchema,
    snippet: snippetSchema,
    remedy: remedySchema.optional(),
    importSpecifier: z.string().min(1).optional(),
    check: reportedCheckSchema.optional(),
  })
  .readonly();

export const isHitSchemaEqual: Equal<DeepReadonly<z.output<typeof hitSchema>>, Hit> = true;

export const measuredPairSchema = z
  .object({
    clause: clauseAddressObjectSchema,
    file: repoPathSchema,
  })
  .readonly();

export const isMeasuredPairSchemaEqual: Equal<
  DeepReadonly<z.output<typeof measuredPairSchema>>,
  MeasuredPair
> = true;

export const measuredSchema = z.array(measuredPairSchema).readonly().optional();

export const caseVerdictSchema = z
  .object({
    caseName: z.string(),
    flaggedLines: z.array(z.number().int().min(1)).readonly(),
  })
  .readonly();

export const isCaseVerdictSchemaEqual: Equal<
  DeepReadonly<z.output<typeof caseVerdictSchema>>,
  CaseVerdict
> = true;

export const projectionWriteSchema = z
  .object({
    path: repoPathSchema,
    effect: z.enum(["written", "unchanged", "removed", "left-in-place"]),
  })
  .readonly();

export const isProjectionWriteSchemaEqual: Equal<
  DeepReadonly<z.output<typeof projectionWriteSchema>>,
  ProjectionWrite
> = true;

export const runnerResultSchema = <Value extends z.ZodType>(request: { readonly value: Value }) =>
  z.union([
    z.object({ outcome: z.literal("ok"), value: request.value }).readonly(),
    z.object({ outcome: z.literal("failed"), error: runnerFailureSchema }).readonly(),
  ]);
