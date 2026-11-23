import type { CheckAddressText } from "../../domain/language-layer/check-address-text.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ToolRuleSet } from "../../domain/rule-set/clause-address-types.ts";
import type { Edition } from "../../domain/rule-set/edition-types.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type { CheckConformanceFailure } from "../../domain/runner/conformance-types.ts";

export type { CheckConformanceFailure } from "../../domain/runner/conformance-types.ts";

export type TeamRuleSetUnderTest = { readonly name: string; readonly root: string };

export type RuleSetUnderTest = ToolRuleSet | TeamRuleSetUnderTest;

export type CheckRequest = {
  readonly ruleSet: RuleSetUnderTest;
  readonly check: CheckAddressText;
  readonly engine: EngineId;
};

export type ConformanceSetupFailureKind =
  | "address-invalid"
  | "check-missing"
  | "file-invalid"
  | "rule-set-invalid"
  | "rule-set-unloadable"
  | "runner-unloadable"
  | "runner-refused";

export type ConformanceSetupFailure = {
  readonly kind: ConformanceSetupFailureKind;
  readonly detail: string;
};

export type CaseUnderTest = {
  readonly name: string;
  readonly file: RepoPath;
  readonly source: string;
  readonly edition: Edition;
};

export type CheckUnderTest = CheckRequest & { readonly examples: readonly CaseUnderTest[] };

export type CheckConformanceOf = (
  request: CheckRequest,
) => Promise<Result<readonly CheckConformanceFailure[], ConformanceSetupFailure>>;

export type CheckUnderTestOf = (
  request: CheckRequest,
) => Result<CheckUnderTest, ConformanceSetupFailure>;

export type RepoPathOf = (request: {
  readonly file: string;
}) => Result<RepoPath, ConformanceSetupFailure>;
