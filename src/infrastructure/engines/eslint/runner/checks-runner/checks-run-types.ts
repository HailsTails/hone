import type { ChecksSliceProblem, MisnamedRuleId } from "../../../../../domain/runner/checks-run-report.ts";
import type { Hit, MeasuredPair, NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import type { ClauseAddress } from "../../../../discipline-exceptions-folder/clause-address.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { AnsweredFile } from "../projection/checks-projection.ts";
import type { RuledCheck } from "../hone-plugin/check-rule-id.ts";
import type { RuleOptions } from "../pieces/eslint-piece-settings-schema.ts";
import type { ProjectedBinding } from "../projection/projected-checks.ts";

export type ChecksRunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly checks: readonly RuledCheck[];
  readonly bindings: readonly ProjectedBinding[];
  readonly answered: readonly AnsweredFile[];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly declaredConfigLookup: EslintConfigLookup | undefined;
};

export type SelectedCheck = {
  readonly address: string;
  readonly symptom: string;
  readonly ruleId: string;
  readonly clause: ClauseAddress;
  readonly options: RuleOptions;
};

export type { MisnamedRuleId };

export type VersionOneRuleId = { readonly ruleId: string; readonly replacedBy: readonly string[] };

export type ChecksProjectionState = "current" | "out-of-date" | "missing" | "not-included";

export type ChecksRunReport = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
  readonly projection: ChecksProjectionState;
  readonly slices: readonly ChecksSliceProblem[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export type NotReadyYetFailure = {
  readonly kind: "not-ready-yet";
  readonly what: { readonly thing: "eslint-config-roots"; readonly paths: readonly string[] };
};

export type ChecksRunFailure = RunnerFailure | NotReadyYetFailure;
