import { z } from "zod";

import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import {
  clauseAddressText,
  sameClauseAddress,
  TOOL_RULE_SET,
} from "../../domain/rule-set/clause-address.ts";
import { NOT_ADOPTED, NOT_RUN } from "../../domain/rule-set/identifiers.ts";
import type { ReportOutput } from "../../domain/settings/report-output.ts";
import type { RunSettings } from "../../domain/settings/run-settings.ts";
import type {
  ClauseChoice,
  ConsumerSelectionFile,
  RuleSetLocation,
} from "../../domain/settings/selection/selection-file.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { eslintConfigLookupSchema } from "../engines/eslint/eslint-config-lookup.ts";
import type {
  DeepReadonlyKeepingTuples,
  Equal,
} from "../engines/protocol/runner-module/type-equality.ts";
import { assessmentSchema, DEFAULT_ASSESSMENT } from "../hone-config-file/assessment.ts";
import { checkEditionsSchema } from "../hone-config-file/check-editions.ts";
import { fileExceptionWhyChainsSchema } from "../hone-config-file/file-exception-why-chains.ts";
import { versionOneEngineIdSchema, ruleSetNameSchema } from "../hone-config-file/identifiers.ts";
import { reportOutputSchema } from "../hone-config-file/report-output.ts";
import {
  brandedRepoPathSchema,
  repoPathSchema,
  repoPathTextSchema,
} from "../hone-records-folder/repo-path.ts";
import { clauseSettingsSchema } from "./clause-settings.ts";

const RULE_SET_SUFFIX_SEPARATOR = "-";

const CLAUSE_ADDRESS_RULE_SET_SEPARATOR = "/";

const LEADING_CURRENT_DIRECTORY = "./";

const clauseChoiceSchema = z.union(
  [
    z.literal(NOT_RUN).transform((): ClauseChoice => ({ state: "not-run" })),
    z.literal(NOT_ADOPTED).transform((): ClauseChoice => ({ state: "not-adopted" })),
    versionOneEngineIdSchema.transform((mechanism): ClauseChoice => ({ state: "run", mechanism })),
  ],
  { error: `a clause takes a mechanism id, "${NOT_RUN}" or "${NOT_ADOPTED}"` },
);

type ClauseListing = ClauseChoice["state"] | "unlisted";

const UNSETTABLE_LISTING_REFUSALS: Readonly<Record<Exclude<ClauseListing, "run">, string>> = {
  unlisted: "clauses does not select it",
  "not-run": "clauses runs no mechanism for it, so remove its settings",
  "not-adopted": "clauses does not adopt it, so remove its settings",
};

const clauseListingOf = (request: {
  readonly clauses: readonly (readonly [ClauseAddress, ClauseChoice])[];
  readonly address: ClauseAddress;
}): ClauseListing =>
  request.clauses.find(
    ([listed]) => sameClauseAddress({ left: listed, right: request.address }) === "same",
  )?.[1].state ?? "unlisted";

const ruleSetLocationSchema = z.union([
  z
    .enum([".", LEADING_CURRENT_DIRECTORY])
    .transform((): RuleSetLocation => ({ location: "repo-root" })),
  z
    .string()
    .transform((text) =>
      text.startsWith(LEADING_CURRENT_DIRECTORY)
        ? text.slice(LEADING_CURRENT_DIRECTORY.length)
        : text,
    )
    .pipe(repoPathSchema)
    .transform((path): RuleSetLocation => ({ location: "folder", path })),
]);

const consumerSelectionFileSchema = z
  .strictObject({
    version: z.literal(1),
    ruleSets: z
      .record(ruleSetNameSchema, z.string())
      .transform((ruleSets) => Object.entries(ruleSets))
      .pipe(z.array(z.tuple([ruleSetNameSchema, ruleSetLocationSchema]))),
    clauses: z
      .record(z.string(), z.string())
      .transform((clauses) => Object.entries(clauses))
      .pipe(z.array(z.tuple([clauseAddressSchema, clauseChoiceSchema]))),
    exclude: z
      .array(
        brandedRepoPathSchema({
          text: repoPathTextSchema.refine((excludedPath) => !excludedPath.includes("*"), {
            error: "an exclude entry is a repository path, not a glob",
          }),
        }),
      )
      .default([]),
    eslintConfigLookup: eslintConfigLookupSchema.optional(),
    eslintConfigRoots: z
      .array(
        brandedRepoPathSchema({
          text: repoPathTextSchema.refine((rootPath) => !rootPath.includes("*"), {
            error: "an eslintConfigRoots entry is a repository folder, not a glob",
          }),
        }),
      )
      .default([]),
    fileExceptionWhyChains: fileExceptionWhyChainsSchema.default("required"),
    reportOutput: reportOutputSchema.default("full"),
    assessment: assessmentSchema.default(DEFAULT_ASSESSMENT),
    clauseSettings: clauseSettingsSchema.default([]),
    checkEditions: checkEditionsSchema.default("pinned"),
  })
  .superRefine((file, context) => {
    const settingsAddresses = file.clauseSettings.map(([address]) => address);
    settingsAddresses
      .flatMap((address) => {
        const listing = clauseListingOf({ clauses: file.clauses, address });
        return listing === "run" ? [] : [{ address, listing }];
      })
      .forEach(({ address, listing }) => {
        const text = clauseAddressText({ address });
        context.addIssue({
          code: "custom",
          path: ["clauseSettings", text],
          message: `clauseSettings for ${text}: ${UNSETTABLE_LISTING_REFUSALS[listing]}`,
        });
      });
    settingsAddresses
      .filter((address, index) =>
        settingsAddresses
          .slice(0, index)
          .some((earlier) => sameClauseAddress({ left: earlier, right: address }) === "same"),
      )
      .forEach((address) => {
        const text = clauseAddressText({ address });
        context.addIssue({
          code: "custom",
          path: ["clauseSettings", text],
          message: `clauseSettings for ${text}: given twice, also as ${TOOL_RULE_SET}${CLAUSE_ADDRESS_RULE_SET_SEPARATOR}${text}`,
        });
      });
  });

export const isConsumerSelectionFileEqual: Equal<
  DeepReadonlyKeepingTuples<z.infer<typeof consumerSelectionFileSchema>>,
  ConsumerSelectionFile
> = true;

const reservedRuleSetNameRefusalOf = (request: {
  readonly file: ConsumerSelectionFile;
}): LoadFailure | undefined => {
  const reserved = request.file.ruleSets.find(
    ([name]) =>
      name === TOOL_RULE_SET || name.startsWith(`${TOOL_RULE_SET}${RULE_SET_SUFFIX_SEPARATOR}`),
  );
  return reserved === undefined ? undefined : { kind: "reserved-rule-set-name", name: reserved[0] };
};

const ruleSetNameCollisionRefusalOf = (request: {
  readonly file: ConsumerSelectionFile;
}): LoadFailure | undefined => {
  const names = request.file.ruleSets.map(([name]) => name);
  const collisions = names.flatMap((name) =>
    names
      .filter((candidate) => candidate.startsWith(`${name}${RULE_SET_SUFFIX_SEPARATOR}`))
      .map((other) => ({ kind: "rule-set-name-collision" as const, name, other })),
  );
  return collisions[0];
};

const duplicateClauseRefusalOf = (request: {
  readonly file: ConsumerSelectionFile;
}): LoadFailure | undefined => {
  const addresses = request.file.clauses.map(([address]) => address);
  const repeated = addresses.find((address, index) =>
    addresses
      .slice(0, index)
      .some((earlier) => sameClauseAddress({ left: earlier, right: address }) === "same"),
  );
  if (repeated === undefined) {
    return undefined;
  }
  const address = clauseAddressText({ address: repeated });
  return {
    kind: "duplicate-clause",
    address,
    prefixedAddress: `${TOOL_RULE_SET}${CLAUSE_ADDRESS_RULE_SET_SEPARATOR}${address}`,
  };
};

const selectionFileRefusalOf = (request: {
  readonly file: ConsumerSelectionFile;
}): LoadFailure | undefined =>
  reservedRuleSetNameRefusalOf(request) ??
  ruleSetNameCollisionRefusalOf(request) ??
  duplicateClauseRefusalOf(request);

export const selectionFileOf = (request: {
  readonly document: unknown;
  readonly path: string;
}): Result<ConsumerSelectionFile, LoadFailure> => {
  const parsed = consumerSelectionFileSchema.safeParse(request.document);
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: { kind: "file-malformed", path: request.path, detail: z.prettifyError(parsed.error) },
    };
  }
  const refusal = selectionFileRefusalOf({ file: parsed.data });
  return refusal === undefined
    ? { outcome: "ok", value: parsed.data }
    : { outcome: "failed", error: refusal };
};

export const runSettingsOf = (request: {
  readonly file: ConsumerSelectionFile;
}): RunSettings<ReportOutput> => ({
  reportOutput: request.file.reportOutput,
  assessment: request.file.assessment,
});
