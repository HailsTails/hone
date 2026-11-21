import { z } from "zod";
import { catalogueNameSchema } from "../content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { recordedReachOf } from "../../domain/records/hone-records/recorded-reach.ts";
import { RECORDS_VERSION } from "../../domain/records/hone-records/records-layout.ts";
import { repoPathSchema } from "./repo-path.ts";
import { whyChainSchema } from "./why-chain.ts";
import type { WrittenRecord } from "../../domain/records/upgrade/records-mapping.ts";
import type { DeepReadonly, Equal } from "../engines/protocol/runner-module/type-equality.ts";

const PACKAGE_NAME = String.raw`(?:@[A-Za-z0-9][A-Za-z0-9._~-]*\/)?[A-Za-z0-9][A-Za-z0-9._~-]*`;

const DOT_SEGMENT = String.raw`\.\.?(?:\/|$)`;

const SUBPATH = String.raw`(?:\/(?!${DOT_SEGMENT})[A-Za-z0-9._~@-]+)*`;

const VERSION = "(?:@[A-Za-z0-9.^~<>=*|+-]+)?";

const RUNTIME = "runtime:[a-z]+";

const NPM_SPECIFIER = `npm:${PACKAGE_NAME}${VERSION}${SUBPATH}`;

const DRIVE_LETTER = "[A-Za-z]:";

const FILE_SCHEME = "file:";

const SCHEME_MODULE = String.raw`(?!runtime:|npm:|${FILE_SCHEME}|${DRIVE_LETTER})[a-z][a-z0-9+.-]*:\S+`;

const textSchema = z.string().trim().min(1);

export const recordedReachSchema = z.string().transform((text, context) => {
  const reach = recordedReachOf({ text });
  if (reach === "not-a-recorded-reach") {
    context.addIssue({ code: "custom", message: "is not a symptom's name, or a symptom's name and one of its checks written <symptom>#<check>" });
    return z.NEVER;
  }
  return reach;
});

export const packageNameSchema = z.string().regex(new RegExp(`^${PACKAGE_NAME}$`), { error: "is not the name of one direct outside dependency" });

export const outsidePartySchema = z
  .string()
  .regex(new RegExp(`^(?:${RUNTIME}|${NPM_SPECIFIER}|${SCHEME_MODULE}|${PACKAGE_NAME}${SUBPATH})$`), {
    error: "is not a runtime facility or an outside module's specifier",
  });

const carriedEntrySchema = z.record(z.string(), z.json());

export const recordsDocumentSchema = z.strictObject({ version: z.literal(RECORDS_VERSION), records: z.array(z.json()) });

export const carriedFormSchema = z.looseObject({ carried: z.json() });

const addressFieldRetirement = (issue: z.core.$ZodRawIssue): string | undefined =>
  issue.code === "unrecognized_keys" && issue.keys.includes("symptom") ? "`symptom` is `answers` in version 2" : undefined;

export const debtWireSchema = z.strictObject(
  { answers: recordedReachSchema, file: repoPathSchema, note: textSchema.optional(), carried: carriedEntrySchema.optional() },
  { error: addressFieldRetirement },
);

export const statedAuthorisedLocationWireSchema = z.strictObject(
  {
    answers: recordedReachSchema,
    file: repoPathSchema,
    case: textSchema,
    owes: textSchema,
    whyChain: whyChainSchema,
  },
  { error: addressFieldRetirement },
);

export const carriedAuthorisedLocationWireSchema = z.strictObject(
  { answers: recordedReachSchema, file: repoPathSchema, carried: carriedEntrySchema },
  { error: addressFieldRetirement },
);

export const isWrittenRecordEqual: Equal<DeepReadonly<z.input<typeof debtWireSchema> | z.input<typeof carriedAuthorisedLocationWireSchema>>, WrittenRecord> = true;

export const statedBoundaryRecordWireSchema = z.strictObject({
  module: repoPathSchema,
  outsideParty: outsidePartySchema,
  ports: z.array(textSchema).min(1),
  conformist: z.strictObject({ model: textSchema, why: textSchema }).optional(),
});

export const carriedBoundaryRecordWireSchema = z.strictObject({ module: repoPathSchema, outsideParty: outsidePartySchema, carried: carriedEntrySchema });

export const deviationWireSchema = z.strictObject({
  recipe: catalogueNameSchema,
  file: repoPathSchema,
  recipeReason: textSchema,
  reasonFails: textSchema,
  evidence: textSchema,
  ruleHolds: textSchema,
});

export const dependencyRecordWireSchema = z.strictObject({
  dependency: packageNameSchema,
  nativeWay: textSchema,
  whyNotEnough: textSchema,
  peerRisk: textSchema.optional(),
});
