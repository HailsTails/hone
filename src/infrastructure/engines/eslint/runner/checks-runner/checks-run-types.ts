import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import type { RuleSetIdentity } from "../../../../../domain/rule-set/clause-address-types.ts";
import type { MisnamedRuleId } from "../../../../../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { RuleOptions } from "../pieces/eslint-piece-settings-schema.ts";

export type { MisnamedRuleId };

export type VersionOneRuleId = { readonly ruleId: string; readonly replacedBy: readonly string[] };

export type ChecksProjectionState = "current" | "out-of-date" | "missing" | "not-included";

export type NotReadyYetFailure = {
  readonly kind: "not-ready-yet";
  readonly what: { readonly thing: "eslint-config-roots"; readonly paths: readonly string[] };
};

export type ChecksRunFailure = RunnerFailure | NotReadyYetFailure;

export type SelectedNamedCheck = {
  readonly ruleSet: RuleSetIdentity;
  readonly address: CheckAddressText;
  readonly symptom: string;
  readonly ruleId: string;
  readonly options: RuleOptions;
};
