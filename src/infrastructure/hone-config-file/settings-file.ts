import { z } from "zod";

import type { SettingsFileFormat } from "../../application/ports/settings/settings-file-format.ts";
import type { Result } from "../../domain/result.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { NOT_ADOPTED, NOT_RUN } from "../../domain/rule-set/identifiers.ts";
import type { ClauseSettingValues } from "../../domain/runner/runner-module-types.ts";
import type { ForfeitureAssessment } from "../../domain/settings/assessment.ts";
import type { CheckEditions } from "../../domain/settings/clause-settings/check-editions.ts";
import type { ConventionsReading } from "../../domain/settings/conventions.ts";
import type { EslintConfigLookup } from "../../domain/settings/eslint-config-lookup.ts";
import { listedAddressText } from "../../domain/settings/listed-address.ts";
import type { VersionTwoReportOutput } from "../../domain/settings/report-output.ts";
import {
  type CheckState,
  type DeclaredRuleSet,
  eslintConfigLookupOf,
  RENAMED_SETTINGS,
  type RuleSetLocation,
  type SettingsFile,
  type SettingsFileFault,
} from "../../domain/settings/settings-file.ts";
import { eslintConfigLookupSchema } from "../engines/eslint/eslint-config-lookup.ts";
import {
  brandedRepoPathSchema,
  repoPathSchema,
  repoPathTextSchema,
} from "../hone-records-folder/repo-path.ts";
import { forfeitureAssessmentSchema } from "./assessment.ts";
import { checkEditionsSchema } from "./check-editions.ts";
import { type ConventionsWire, conventionsOf, conventionsWireOf } from "./conventions.ts";
import { ruleSetNameSchema } from "./identifiers.ts";
import { listedAddressSchema } from "./listed-address.ts";
import { versionTwoReportOutputSchema } from "./report-output.ts";

const RULE_SET_SUFFIX_SEPARATOR = "-";

const LEADING_CURRENT_DIRECTORY = "./";

const ENGINE_NAME_TEXT = /^[a-z][a-z0-9-]*$/;

const SETTINGS_FILE_VERSION = 2;

const REPOSITORY_ROOT_TEXT = ".";

const DEFAULT_FORFEITURE: ForfeitureAssessment = "this-run";

const DEFAULT_REPORT_OUTPUT: VersionTwoReportOutput = "full";

const DEFAULT_CHECK_EDITIONS: CheckEditions = "pinned";

const JSON_INDENT = 2;

const retiredKeySchema = (request: { readonly refusal: string }) =>
  z.never({ error: request.refusal }).optional();

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

const checkStateSchema = z.union(
  [
    z.literal(NOT_RUN).transform((): CheckState => ({ state: "not-run" })),
    z.literal(NOT_ADOPTED).transform((): CheckState => ({ state: "not-adopted" })),
    z
      .string()
      .regex(ENGINE_NAME_TEXT)
      .transform((engine): CheckState => ({ state: "run", engine })),
  ],
  { error: `a check takes an engine, "${NOT_RUN}" or "${NOT_ADOPTED}"` },
);

const settingValuesSchema = z.record(z.string(), z.json()).superRefine((values, context) => {
  RENAMED_SETTINGS.filter(({ pieceName }) => Object.hasOwn(values, pieceName)).forEach(
    ({ name, pieceName }) => {
      context.addIssue({
        code: "custom",
        path: [pieceName],
        message: `renamed: "${pieceName}" is "${name}" in version 2`,
      });
    },
  );
});

const folderListSchema = (request: { readonly refusal: string }) =>
  z
    .array(
      brandedRepoPathSchema({
        text: repoPathTextSchema.refine((folder) => !folder.includes("*"), {
          error: request.refusal,
        }),
      }),
    )
    .default([]);

const settingsFileWireSchema = z.strictObject({
  version: z.literal(SETTINGS_FILE_VERSION),
  exclude: folderListSchema({ refusal: "an exclude entry is a repository path, not a glob" }),
  ruleSets: z
    .record(ruleSetNameSchema, z.string())
    .transform((ruleSets) => Object.entries(ruleSets))
    .pipe(z.array(z.tuple([ruleSetNameSchema, ruleSetLocationSchema]))),
  checks: z
    .record(z.string(), z.string())
    .transform((checks) => Object.entries(checks))
    .pipe(z.array(z.tuple([listedAddressSchema, checkStateSchema]))),
  checkSettings: z
    .record(z.string(), settingValuesSchema)
    .transform((settings) => Object.entries(settings))
    .pipe(z.array(z.tuple([listedAddressSchema, z.record(z.string(), z.json())])))
    .default([]),
  forfeiture: forfeitureAssessmentSchema.default(DEFAULT_FORFEITURE),
  reportOutput: versionTwoReportOutputSchema.default(DEFAULT_REPORT_OUTPUT),
  checkEditions: checkEditionsSchema.default(DEFAULT_CHECK_EDITIONS),
  eslintConfigLookup: eslintConfigLookupSchema.optional(),
  eslintConfigRoots: folderListSchema({
    refusal: "an eslintConfigRoots entry is a repository folder, not a glob",
  }),
  generated: z.unknown().optional(),
  layers: z.unknown().optional(),
  clauses: retiredKeySchema({
    refusal: 'renamed: "clauses" is "checks" in version 2, addressed <symptom>#<check>',
  }),
  clauseSettings: retiredKeySchema({
    refusal:
      'renamed: "clauseSettings" is "checkSettings" in version 2, addressed <symptom>#<check>',
  }),
  assessment: retiredKeySchema({
    refusal: 'renamed: "assessment" is "forfeiture" in version 2, at the top level',
  }),
  conventions: retiredKeySchema({
    refusal: 'renamed: "conventions" is gone in version 2; its "generated" is a top-level key',
  }),
  fileExceptionWhyChains: retiredKeySchema({
    refusal: 'removed: "fileExceptionWhyChains"; every record shows its why-chain in version 2',
  }),
});

type SettingsFileWire = z.infer<typeof settingsFileWireSchema>;

const ruleSetFaultOf = (request: {
  readonly ruleSets: readonly DeclaredRuleSet[];
}): SettingsFileFault | undefined => {
  const names: readonly string[] = request.ruleSets.map(({ name }) => name);
  const reserved = names.find(
    (name) =>
      name === TOOL_RULE_SET || name.startsWith(`${TOOL_RULE_SET}${RULE_SET_SUFFIX_SEPARATOR}`),
  );
  if (reserved !== undefined) {
    return { kind: "reserved-rule-set-name", name: reserved };
  }
  const collisions = names.flatMap((name) =>
    names
      .filter((other) => other.startsWith(`${name}${RULE_SET_SUFFIX_SEPARATOR}`))
      .map((other): SettingsFileFault => ({ kind: "rule-set-name-collision", name, other })),
  );
  return collisions[0];
};

const settingsFileOfWire = (request: {
  readonly wire: SettingsFileWire;
  readonly conventions: ConventionsReading;
}): SettingsFile => ({
  exclude: request.wire.exclude,
  ruleSets: request.wire.ruleSets.map(([name, location]) => ({ name, location })),
  checks: request.wire.checks.map(([address, state]) => ({ address, state })),
  checkSettings: request.wire.checkSettings.map(([address, values]) => ({ address, values })),
  forfeiture: request.wire.forfeiture,
  reportOutput: request.wire.reportOutput,
  checkEditions: request.wire.checkEditions,
  eslintConfigLookup: eslintConfigLookupOf({ declared: request.wire.eslintConfigLookup }),
  eslintConfigRoots: request.wire.eslintConfigRoots,
  conventions: request.conventions,
});

type WireEntry<Value> = readonly [string, Value];

export type SettingsWire = {
  readonly version: typeof SETTINGS_FILE_VERSION;
  readonly ruleSets: Readonly<Record<string, string>>;
  readonly checks: Readonly<Record<string, string>>;
  readonly checkSettings?: Readonly<Record<string, ClauseSettingValues>>;
  readonly exclude?: readonly string[];
  readonly eslintConfigRoots?: readonly string[];
  readonly forfeiture?: ForfeitureAssessment;
  readonly reportOutput?: VersionTwoReportOutput;
  readonly checkEditions?: CheckEditions;
  readonly eslintConfigLookup?: EslintConfigLookup;
} & ConventionsWire;

const byKey = <Value>(request: {
  readonly left: WireEntry<Value>;
  readonly right: WireEntry<Value>;
}): number =>
  request.left[0] < request.right[0] ? -1 : request.left[0] > request.right[0] ? 1 : 0;

const sortedRecordOf = <Value>(request: {
  readonly entries: readonly WireEntry<Value>[];
}): Readonly<Record<string, Value>> =>
  Object.fromEntries(request.entries.toSorted((left, right) => byKey({ left, right })));

const locationTextOf = (request: { readonly location: RuleSetLocation }): string =>
  request.location.location === "repo-root" ? REPOSITORY_ROOT_TEXT : request.location.path;

const stateTextOf = (request: { readonly state: CheckState }): string => {
  switch (request.state.state) {
    case "run":
      return request.state.engine;
    case "not-run":
      return NOT_RUN;
    case "not-adopted":
      return NOT_ADOPTED;
  }
};

const withheldWhenDefault = <Value>(request: {
  readonly value: Value;
  readonly standard: Value;
}): { readonly given?: Value } =>
  request.value === request.standard ? {} : { given: request.value };

const settingsWireOfDefaults = (request: {
  readonly settings: SettingsFile;
}): Omit<SettingsWire, "version" | "ruleSets" | "checks"> => {
  const { settings } = request;
  const forfeiture = withheldWhenDefault({
    value: settings.forfeiture,
    standard: DEFAULT_FORFEITURE,
  }).given;
  const reportOutput = withheldWhenDefault({
    value: settings.reportOutput,
    standard: DEFAULT_REPORT_OUTPUT,
  }).given;
  const checkEditions = withheldWhenDefault({
    value: settings.checkEditions,
    standard: DEFAULT_CHECK_EDITIONS,
  }).given;
  return {
    ...(settings.checkSettings.length === 0
      ? {}
      : {
          checkSettings: sortedRecordOf({
            entries: settings.checkSettings.map((given): WireEntry<ClauseSettingValues> => [
              listedAddressText({ address: given.address }),
              given.values,
            ]),
          }),
        }),
    ...(settings.exclude.length === 0 ? {} : { exclude: settings.exclude }),
    ...(settings.eslintConfigRoots.length === 0
      ? {}
      : { eslintConfigRoots: settings.eslintConfigRoots }),
    ...(forfeiture === undefined ? {} : { forfeiture }),
    ...(reportOutput === undefined ? {} : { reportOutput }),
    ...(checkEditions === undefined ? {} : { checkEditions }),
    ...(settings.eslintConfigLookup.lookup === "declared"
      ? { eslintConfigLookup: settings.eslintConfigLookup.value }
      : {}),
    ...conventionsWireOf({ reading: settings.conventions }),
  };
};

export const settingsWireOf = (request: { readonly settings: SettingsFile }): SettingsWire => ({
  version: SETTINGS_FILE_VERSION,
  ruleSets: sortedRecordOf({
    entries: request.settings.ruleSets.map(({ name, location }): WireEntry<string> => [
      name,
      locationTextOf({ location }),
    ]),
  }),
  checks: sortedRecordOf({
    entries: request.settings.checks.map(({ address, state }): WireEntry<string> => [
      listedAddressText({ address }),
      stateTextOf({ state }),
    ]),
  }),
  ...settingsWireOfDefaults({ settings: request.settings }),
});

export const settingsTextOf = (request: { readonly settings: SettingsFile }): string =>
  `${JSON.stringify(settingsWireOf({ settings: request.settings }), null, JSON_INDENT)}\n`;

export const settingsFileOf = (request: {
  readonly document: unknown;
}): Result<SettingsFile, SettingsFileFault> => {
  const parsed = settingsFileWireSchema.safeParse(request.document);
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: { kind: "malformed", detail: z.prettifyError(parsed.error) },
    };
  }
  const conventions = conventionsOf({
    document: { generated: parsed.data.generated, layers: parsed.data.layers ?? {} },
  });
  if (conventions.outcome === "failed") {
    return { outcome: "failed", error: { kind: "malformed", detail: conventions.error } };
  }
  const file = settingsFileOfWire({ wire: parsed.data, conventions: conventions.value });
  const fault = ruleSetFaultOf({ ruleSets: file.ruleSets });
  return fault === undefined ? { outcome: "ok", value: file } : { outcome: "failed", error: fault };
};

export const SETTINGS_FILE_FORMAT: SettingsFileFormat = {
  fileOf: settingsFileOf,
  documentOf: settingsWireOf,
  textOf: settingsTextOf,
};
