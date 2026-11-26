import { z } from "zod";

import type { RecordsDocumentRefusal } from "../../../../domain/records/hone-records/hone-record.ts";
import type { EngineNaming, RunLoadFailure } from "../../../../domain/report/run-load-failure.ts";
import type {
  MissingProjection,
  RunProjectionProblem,
} from "../../../../domain/report/run-report.ts";
import {
  engineIdSchema,
  ruleSetIdentitySchema,
  ruleSetNameSchema,
} from "../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { runnerFailureSchema } from "../runner-module/runner-failure-schema.ts";
import type { DeepReadonlyKeepingTuples, Equal } from "../runner-module/type-equality.ts";

const engineSchema = z.strictObject({ name: engineIdSchema });

const engineNamingSchema = z.discriminatedUnion("named", [
  z.strictObject({ named: z.literal("engine"), engine: engineSchema }),
  z.strictObject({ named: z.literal("mechanism"), mechanism: engineIdSchema }),
]);

const allowedEnginesSchema = z.discriminatedUnion("stated", [
  z.strictObject({ stated: z.literal("by-catalogue"), engines: z.array(z.string()).readonly() }),
  z.strictObject({ stated: z.literal("by-rule-set") }),
]);

const projectionProblemSchema = z.union([
  z.strictObject({
    scope: z.literal("projection"),
    engine: engineSchema,
    state: z.literal("out-of-date"),
    file: repoPathSchema,
  }),
  z.strictObject({
    scope: z.literal("file"),
    engine: engineSchema,
    state: z.literal("left-over"),
    file: repoPathSchema,
  }),
  z.strictObject({
    scope: z.literal("slice"),
    engine: engineSchema,
    state: z.enum(["out-of-date", "missing", "unconfigured"]),
    file: repoPathSchema,
  }),
  z.strictObject({
    kind: z.literal("engine-not-run"),
    engine: engineSchema,
    projection: z.literal("missing"),
    file: repoPathSchema,
  }),
]);

const recordsRefusalSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("not-a-records-file"), file: repoPathSchema }),
  z.strictObject({
    kind: z.literal("unknown-rule-set"),
    file: repoPathSchema,
    ruleSet: ruleSetNameSchema,
  }),
  z.strictObject({
    kind: z.literal("document-refused"),
    file: repoPathSchema,
    issues: z
      .array(
        z.strictObject({
          path: z.array(z.union([z.string(), z.number()])).readonly(),
          message: z.string(),
        }),
      )
      .readonly(),
  }),
]);

export const runLoadFailureSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("arguments-invalid"), detail: z.string() }),
  z.strictObject({
    kind: z.literal("install-root-unresolvable"),
    url: z.string(),
    detail: z.string(),
  }),
  z.strictObject({ kind: z.literal("file-unreadable"), path: z.string(), detail: z.string() }),
  z.strictObject({ kind: z.literal("file-malformed"), path: z.string(), detail: z.string() }),
  z.strictObject({ kind: z.literal("file-unwritable"), path: z.string(), detail: z.string() }),
  z.strictObject({ kind: z.literal("file-unremovable"), file: repoPathSchema, detail: z.string() }),
  z.strictObject({ kind: z.literal("unsupported-version"), path: z.string(), found: z.unknown() }),
  z.strictObject({ kind: z.literal("reserved-rule-set-name"), name: z.string() }),
  z.strictObject({
    kind: z.literal("rule-set-name-collision"),
    name: z.string(),
    other: z.string(),
  }),
  z.strictObject({
    kind: z.literal("rule-sets-share-a-check"),
    check: z.string(),
    ruleSets: z.tuple([z.string(), z.string()]).readonly(),
  }),
  z.strictObject({ kind: z.literal("unknown-rule-set"), name: z.string() }),
  z.strictObject({ kind: z.literal("rule-set-invalid"), path: z.string(), detail: z.string() }),
  z.strictObject({ kind: z.literal("rule-set-not-upgraded"), path: z.string() }),
  z.strictObject({
    kind: z.literal("rule-set-half-upgraded"),
    path: z.string(),
    files: z.array(z.string()).readonly(),
  }),
  z.strictObject({ kind: z.literal("git-failed"), detail: z.string() }),
  z.strictObject({ kind: z.literal("config-root-untracked"), root: repoPathSchema }),
  z.strictObject({ kind: z.literal("unexpected-error"), detail: z.string() }),
  z.strictObject({ kind: z.literal("config-absent"), repo: z.string() }),
  z.strictObject({ kind: z.literal("settings-in-both-versions"), repo: z.string() }),
  z.strictObject({
    kind: z.literal("not-ready-yet"),
    what: z.strictObject({ thing: z.literal("command"), command: z.string() }),
  }),
  z.strictObject({ kind: z.literal("unknown-check"), check: z.string() }),
  z.strictObject({ kind: z.literal("review-only-listed"), check: z.string() }),
  z.strictObject({
    kind: z.literal("duplicate-check"),
    key: z.enum(["checks", "checkSettings"]),
    check: z.string(),
    prefixedCheck: z.string(),
  }),
  z.strictObject({
    kind: z.literal("engine-not-allowed"),
    check: z.string(),
    engine: z.string(),
    allowed: allowedEnginesSchema,
  }),
  z.strictObject({ kind: z.literal("engine-missing"), engine: engineNamingSchema }),
  z.strictObject({
    kind: z.literal("engine-invalid"),
    engine: engineNamingSchema,
    detail: z.string(),
  }),
  z.strictObject({
    kind: z.literal("engine-failed"),
    engine: engineNamingSchema,
    failure: runnerFailureSchema,
  }),
  z.strictObject({
    kind: z.literal("check-missing"),
    check: z.string(),
    engine: engineNamingSchema,
  }),
  z.strictObject({
    kind: z.literal("checks-run-together"),
    check: z.string(),
    others: z.array(z.string()).readonly(),
  }),
  z.strictObject({
    kind: z.literal("check-settings-refused"),
    check: z.string(),
    listing: z.enum(["unlisted", "not-run", "not-adopted"]),
  }),
  z.strictObject({
    kind: z.literal("check-settings-differ"),
    check: z.string(),
    other: z.string(),
  }),
  z.strictObject({
    kind: z.literal("projection-stale"),
    problem: projectionProblemSchema,
    projectCommand: z.string(),
  }),
  z.strictObject({
    kind: z.literal("records-folder-unreadable"),
    folder: repoPathSchema,
    detail: z.string(),
  }),
  z.strictObject({
    kind: z.literal("records-file-unreadable"),
    file: repoPathSchema,
    detail: z.string(),
  }),
  z.strictObject({
    kind: z.literal("records-file-not-json"),
    file: repoPathSchema,
    detail: z.string(),
  }),
  z.strictObject({ kind: z.literal("not-a-records-file"), file: repoPathSchema }),
  z.strictObject({
    kind: z.literal("not-a-records-name"),
    folder: repoPathSchema,
    name: z.string(),
  }),
  z.strictObject({
    kind: z.literal("records-refused"),
    refusals: z.array(recordsRefusalSchema).readonly(),
  }),
  z.strictObject({
    kind: z.literal("catalogue-not-read"),
    path: z.string(),
    reason: z.discriminatedUnion("reason", [
      z.strictObject({ reason: z.literal("absent") }),
      z.strictObject({ reason: z.literal("unreadable"), detail: z.string() }),
    ]),
  }),
  z.strictObject({ kind: z.literal("upgrade-needed"), path: z.string() }),
  z.strictObject({
    kind: z.literal("symptom-unheld"),
    symptom: z.strictObject({ ruleSet: ruleSetIdentitySchema, name: z.string() }),
  }),
]);

export const isEngineNamingSchemaEqual: Equal<
  DeepReadonlyKeepingTuples<z.output<typeof engineNamingSchema>>,
  EngineNaming
> = true;

export const isProjectionProblemSchemaEqual: Equal<
  DeepReadonlyKeepingTuples<z.output<typeof projectionProblemSchema>>,
  RunProjectionProblem | MissingProjection
> = true;

export const isRecordsRefusalSchemaEqual: Equal<
  DeepReadonlyKeepingTuples<z.output<typeof recordsRefusalSchema>>,
  RecordsDocumentRefusal
> = true;

export const isRunLoadFailureSchemaEqual: Equal<
  DeepReadonlyKeepingTuples<z.output<typeof runLoadFailureSchema>>,
  RunLoadFailure
> = true;
