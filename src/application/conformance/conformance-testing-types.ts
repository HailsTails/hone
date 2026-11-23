import type { CheckAddressText } from "../../domain/language-layer/check-address-text.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { Edition } from "../../domain/rule-set/edition-types.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type {
  CheckConformanceFailure,
  ConformanceFailure,
} from "../../domain/runner/conformance-types.ts";
import type { RunnerClause } from "../../domain/runner/runner-module-types.ts";

export type {
  CheckConformanceFailure,
  ConformanceFailure,
} from "../../domain/runner/conformance-types.ts";

export type CheckRequest = { readonly check: CheckAddressText; readonly engine: EngineId };

export type ClauseRequest = { readonly ruleSetRoot: string; readonly clause: string };

export type ConformanceSetupFailureKind =
  | "address-invalid"
  | "check-missing"
  | "file-invalid"
  | "rule-set-unloadable"
  | "clause-not-mechanical"
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

export type ClauseUnderTest = {
  readonly clause: RunnerClause;
  readonly cases: readonly CaseUnderTest[];
};

export type ClauseConformanceOf = (
  request: ClauseRequest,
) => Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>>;

export type ClauseUnderTestOf = (
  request: ClauseRequest,
) => Result<ClauseUnderTest, ConformanceSetupFailure>;

export type CheckConformanceOf = (
  request: CheckRequest,
) => Promise<Result<readonly CheckConformanceFailure[], ConformanceSetupFailure>>;

export type CheckUnderTestOf = (
  request: CheckRequest,
) => Result<CheckUnderTest, ConformanceSetupFailure>;

export type RepoPathOf = (request: {
  readonly file: string;
}) => Result<RepoPath, ConformanceSetupFailure>;
