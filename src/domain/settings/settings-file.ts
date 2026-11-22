import type { RepoPath } from "../repository/repo-path-types.ts";
import type { RuleSetName } from "../rule-set/identifier-types.ts";
import type { ClauseSettingValues } from "../runner/runner-module-types.ts";
import type { ForfeitureAssessment } from "./assessment.ts";
import type { CheckEditions } from "./clause-settings/check-editions.ts";
import type { ConventionsReading } from "./conventions.ts";
import type { EslintConfigLookup } from "./eslint-config-lookup.ts";
import type { ListedAddress } from "./listed-address.ts";
import type { VersionTwoReportOutput } from "./report-output.ts";

export const SETTINGS_FILE_NAME = "hone.config.json";

export const VERSION_ONE_SETTINGS_FILE_NAME = "disciplines.json";

export type RuleSetLocation = { readonly location: "repo-root" } | { readonly location: "folder"; readonly path: RepoPath };

export type DeclaredRuleSet = { readonly name: RuleSetName; readonly location: RuleSetLocation };

export type CheckState = { readonly state: "run"; readonly engine: string } | { readonly state: "not-run" } | { readonly state: "not-adopted" };

export type ListedCheck = { readonly address: ListedAddress; readonly state: CheckState };

export type GivenCheckSettings = { readonly address: ListedAddress; readonly values: ClauseSettingValues };

export type EslintConfigLookupChoice = { readonly lookup: "detected" } | { readonly lookup: "declared"; readonly value: EslintConfigLookup };

export type SettingsFile = {
  readonly exclude: readonly RepoPath[];
  readonly ruleSets: readonly DeclaredRuleSet[];
  readonly checks: readonly ListedCheck[];
  readonly checkSettings: readonly GivenCheckSettings[];
  readonly forfeiture: ForfeitureAssessment;
  readonly reportOutput: VersionTwoReportOutput;
  readonly checkEditions: CheckEditions;
  readonly eslintConfigLookup: EslintConfigLookupChoice;
  readonly eslintConfigRoots: readonly RepoPath[];
  readonly conventions: ConventionsReading;
};

export type SettingsFileFault =
  | { readonly kind: "malformed"; readonly detail: string }
  | { readonly kind: "reserved-rule-set-name"; readonly name: string }
  | { readonly kind: "rule-set-name-collision"; readonly name: string; readonly other: string };

export const RENAMED_SETTINGS = [{ name: "confinedOutsideDependencies", pieceName: "confinedPackages" }] as const;

export const eslintConfigLookupOf = (request: { readonly declared: EslintConfigLookup | undefined }): EslintConfigLookupChoice =>
  request.declared === undefined ? { lookup: "detected" } : { lookup: "declared", value: request.declared };
