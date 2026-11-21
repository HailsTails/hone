import { z } from "zod";
import { anchorSchema } from "./anchor-schema.ts";
import { type ClauseAddress, clauseAddressObjectSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { snippetSchema } from "./snippet.ts";
import type { DeepReadonly, Equal } from "./type-equality.ts";
import { runnerFailureSchema } from "./runner-failure-schema.ts";
import type { Hit, MeasuredPair } from "../../../../application/ports/runner-result-types.ts";

export type { Hit, MeasuredPair } from "../../../../application/ports/runner-result-types.ts";

export const reportedCheckSchema = z.string().min(1);

export const nativeExceptionKindSchema = z.enum([
  "ignore",
  "config-override",
  "suppression-entry",
  "inline-disable",
  "inline-rule-config",
  "command-line-option",
]);

export type InlineReach = "one-clause" | "every-selected-clause";

export type ScriptOptionCause =
  | { readonly kind: "weakens-run" }
  | { readonly kind: "after-another-command"; readonly command: string; readonly invocation: string }
  | { readonly kind: "wrapped"; readonly command: string; readonly wrapper: string }
  | { readonly kind: "unreadable"; readonly command: string };

export type NativeException =
  | { readonly kind: "ignore"; readonly check?: string; readonly clause: ClauseAddress; readonly file: RepoPath }
  | { readonly kind: "config-override"; readonly check?: string; readonly clause: ClauseAddress; readonly file: RepoPath }
  | {
      readonly kind: "suppression-entry";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly location: RepoPath;
    }
  | {
      readonly kind: "inline-disable";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
      readonly reach: InlineReach;
    }
  | {
      readonly kind: "inline-rule-config";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
    }
  | {
      readonly kind: "command-line-option";
      readonly check?: string;
      readonly clause: ClauseAddress;
      readonly location: RepoPath;
      readonly script: string;
      readonly option: string;
      readonly cause: ScriptOptionCause;
    };

export type InlineDisable = Extract<NativeException, { readonly kind: "inline-disable" }>;

export type ProjectionState = "current" | "out-of-date" | "missing" | "not-included";

const PAGE_SECTION = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PAGE_IN_RULE_FOLDER = /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.md$/;

export const remedySchema = z
  .object({
    fix: z.string().min(1),
    page: z.string().regex(PAGE_IN_RULE_FOLDER),
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

export const isMeasuredPairSchemaEqual: Equal<DeepReadonly<z.output<typeof measuredPairSchema>>, MeasuredPair> = true;

export const measuredSchema = z.array(measuredPairSchema).readonly().optional();

export const caseVerdictSchema = z
  .object({
    caseName: z.string(),
    flaggedLines: z.array(z.number().int().min(1)).readonly(),
  })
  .readonly();

export type CaseVerdict = z.infer<typeof caseVerdictSchema>;

export const projectionWriteSchema = z
  .object({
    path: repoPathSchema,
    effect: z.enum(["written", "unchanged", "removed", "left-in-place"]),
  })
  .readonly();

export type ProjectionWrite = z.infer<typeof projectionWriteSchema>;

export const runnerResultSchema = <Value extends z.ZodType>(request: {
  readonly value: Value;
}) =>
  z.union([
    z.object({ outcome: z.literal("ok"), value: request.value }).readonly(),
    z.object({ outcome: z.literal("failed"), error: runnerFailureSchema }).readonly(),
  ]);
