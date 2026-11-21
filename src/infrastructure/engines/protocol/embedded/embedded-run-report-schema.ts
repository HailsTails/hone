import { z } from "zod";
import { clauseAddressObjectSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { DeepReadonly, Equal } from "../runner-module/type-equality.ts";
import { hitSchema, type InlineReach, type NativeException, measuredSchema, type ProjectionState, reportedCheckSchema, type ScriptOptionCause } from "../runner-module/runner-result-schema.ts";

const namedCheck = { check: reportedCheckSchema.optional() };

const inlineLineSchema = z.number().int().min(1);

export const inlineDisableSchema = z
  .object({
    kind: z.literal("inline-disable"),
    ...namedCheck,
    clause: clauseAddressObjectSchema,
    file: repoPathSchema,
    line: inlineLineSchema,
    text: z.string(),
    reach: z.enum(["one-clause", "every-selected-clause"]),
  })
  .readonly();

const scriptOptionCauseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weakens-run") }).readonly(),
  z.object({ kind: z.literal("after-another-command"), command: z.string(), invocation: z.string() }).readonly(),
  z.object({ kind: z.literal("wrapped"), command: z.string(), wrapper: z.string() }).readonly(),
  z.object({ kind: z.literal("unreadable"), command: z.string() }).readonly(),
]);

export const nativeExceptionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("ignore"), ...namedCheck, clause: clauseAddressObjectSchema, file: repoPathSchema })
    .readonly(),
  z
    .object({
      kind: z.literal("config-override"),
      ...namedCheck,
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
    })
    .readonly(),
  z
    .object({
      kind: z.literal("suppression-entry"),
      ...namedCheck,
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      location: repoPathSchema,
    })
    .readonly(),
  inlineDisableSchema,
  z
    .object({
      kind: z.literal("inline-rule-config"),
      ...namedCheck,
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      line: inlineLineSchema,
      text: z.string(),
    })
    .readonly(),
  z
    .object({
      kind: z.literal("command-line-option"),
      ...namedCheck,
      clause: clauseAddressObjectSchema,
      location: repoPathSchema,
      script: z.string(),
      option: z.string(),
      cause: scriptOptionCauseSchema,
    })
    .readonly(),
]);

export const sliceProblemSchema = z
  .object({
    slice: repoPathSchema,
    state: z.enum(["out-of-date", "missing", "not-applied", "unconfigured", "nested-configuration"]),
  })
  .readonly();

export type SliceProblem = z.infer<typeof sliceProblemSchema>;

export const unprojectedFolderSchema = z
  .object({
    folder: repoPathSchema,
    selectionFolder: repoPathSchema,
  })
  .readonly();

export type UnprojectedFolderReport = z.infer<typeof unprojectedFolderSchema>;

export const embeddedRunReportSchema = z
  .object({
    hits: z.array(hitSchema).readonly(),
    nativeExceptions: z.array(nativeExceptionSchema).readonly(),
    projection: z.enum(["current", "out-of-date", "missing", "not-included"]),
    slices: z.array(sliceProblemSchema).readonly().default([]),
    unprojectedFolders: z.array(unprojectedFolderSchema).readonly().default([]),
    measured: measuredSchema,
  })
  .readonly();

export type EmbeddedRunReport = z.infer<typeof embeddedRunReportSchema>;

export type ReturnedEmbeddedRunReport = Omit<EmbeddedRunReport, "unprojectedFolders"> &
  Partial<Pick<EmbeddedRunReport, "unprojectedFolders">>;

export const isInlineReachEqual: Equal<z.infer<typeof inlineDisableSchema>["reach"], InlineReach> = true;

export const isScriptOptionCauseEqual: Equal<z.infer<typeof scriptOptionCauseSchema>, ScriptOptionCause> = true;

export const isProjectionStateEqual: Equal<EmbeddedRunReport["projection"], ProjectionState> =
  true;

export const isNativeExceptionSchemaEqual: Equal<DeepReadonly<z.output<typeof nativeExceptionSchema>>, NativeException> = true;
