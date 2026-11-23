import { z } from "zod";

import { isCheckAddressText } from "../../../../domain/language-layer/check-address-text.ts";
import { editionSchema } from "../../../content-files/edition.ts";
import { anchorKindSchema } from "../../../content-files/rule-sets/rule-set-reader.ts";
import { engineIdSchema, ruleSetNameSchema } from "../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { anchorSchema } from "../runner-module/anchor-schema.ts";
import { remedySchema } from "../runner-module/runner-result-schema.ts";
import { snippetSchema } from "../runner-module/snippet.ts";

export const checkAddressSchema = z
  .string()
  .refine(isCheckAddressText, { error: "expected a symptom and check address" });

export const checkBindingSchema = z
  .strictObject({
    address: checkAddressSchema,
    ruleSet: ruleSetNameSchema.optional(),
    engine: engineIdSchema,
    anchor: anchorKindSchema,
    pieceRoot: z.string().min(1),
    settings: z.json(),
    forms: z.record(z.string(), checkAddressSchema).optional(),
    checkSettings: z.record(z.string(), z.json()),
    edition: editionSchema,
  })
  .readonly();

const measurement = { check: checkAddressSchema, file: repoPathSchema };

export const checkMeasurementSchema = z.strictObject(measurement).readonly();

export const checkHitSchema = z
  .strictObject({
    ...measurement,
    anchor: anchorSchema,
    snippet: snippetSchema,
    remedy: remedySchema.optional(),
    importSpecifier: z.string().min(1).optional(),
  })
  .readonly();

const scriptOptionCauseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("weakens-run") }),
  z.strictObject({
    kind: z.literal("after-another-command"),
    command: z.string(),
    invocation: z.string(),
  }),
  z.strictObject({ kind: z.literal("wrapped"), command: z.string(), wrapper: z.string() }),
  z.strictObject({ kind: z.literal("shell-supplied"), command: z.string(), value: z.string() }),
  z.strictObject({ kind: z.literal("unreadable"), command: z.string() }),
]);

const inline = { line: z.number().int().min(1), text: z.string() };

export const checkNativeExceptionSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("ignore"), ...measurement }),
    z.strictObject({ kind: z.literal("config-override"), ...measurement }),
    z.strictObject({
      kind: z.literal("suppression-entry"),
      ...measurement,
      location: repoPathSchema,
    }),
    z.strictObject({
      kind: z.literal("inline-disable"),
      ...measurement,
      ...inline,
      reach: z.enum(["one-check", "every-selected-check"]),
    }),
    z.strictObject({ kind: z.literal("inline-rule-config"), ...measurement, ...inline }),
    z.strictObject({
      kind: z.literal("command-line-option"),
      check: checkAddressSchema,
      location: repoPathSchema,
      script: z.string(),
      option: z.string(),
      cause: scriptOptionCauseSchema,
    }),
  ])
  .readonly();
