import type { LegacyClauseAddress } from "../../rule-set/clause-address-types.ts";
import type { MechanismId, RuleSetName } from "../../rule-set/identifier-types.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { Assessment } from "../assessment.ts";
import type { CheckEditions } from "../clause-settings/check-editions.ts";
import type { ClauseSettings } from "../clause-settings/clause-settings.ts";
import type { EslintConfigLookup } from "../eslint-config-lookup.ts";
import type { ReportOutput } from "../report-output.ts";
import type { FileExceptionWhyChains } from "./file-exception-why-chains.ts";

export type RuleSetLocation =
  | { readonly location: "repo-root" }
  | { readonly location: "folder"; readonly path: RepoPath };

export type ClauseChoice =
  | { readonly state: "run"; readonly mechanism: MechanismId }
  | { readonly state: "not-run" }
  | { readonly state: "not-adopted" };

export type UnrunState = Exclude<ClauseChoice["state"], "run">;

export type ConsumerSelectionFile = {
  readonly version: 1;
  readonly ruleSets: readonly (readonly [RuleSetName, RuleSetLocation])[];
  readonly clauses: readonly (readonly [LegacyClauseAddress, ClauseChoice])[];
  readonly exclude: readonly RepoPath[];
  readonly eslintConfigLookup?: EslintConfigLookup;
  readonly eslintConfigRoots: readonly RepoPath[];
  readonly fileExceptionWhyChains: FileExceptionWhyChains;
  readonly reportOutput: ReportOutput;
  readonly assessment: Assessment;
  readonly clauseSettings: ClauseSettings;
  readonly checkEditions: CheckEditions;
};
