import type { RunnerClause } from "../../domain/runner/runner-module-types.ts";
import type { Edition } from "../../domain/rule-set/edition-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ConformanceFailure } from "../../domain/runner/conformance-types.ts";

export type { ConformanceFailure } from "../../domain/runner/conformance-types.ts";

export type ClauseRequest = { readonly ruleSetRoot: string; readonly clause: string };

export type ConformanceSetupFailureKind =
  | "address-invalid"
  | "file-invalid"
  | "rule-set-unloadable"
  | "clause-not-mechanical"
  | "runner-unloadable"
  | "runner-refused";

export type ConformanceSetupFailure = { readonly kind: ConformanceSetupFailureKind; readonly detail: string };

export type CaseUnderTest = {
  readonly name: string;
  readonly file: RepoPath;
  readonly source: string;
  readonly edition: Edition;
};

export type ClauseUnderTest = { readonly clause: RunnerClause; readonly cases: readonly CaseUnderTest[] };

export type ClauseConformanceOf = (
  request: ClauseRequest,
) => Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>>;

export type ClauseUnderTestOf = (request: ClauseRequest) => Result<ClauseUnderTest, ConformanceSetupFailure>;

export type RepoPathOf = (request: { readonly file: string }) => Result<RepoPath, ConformanceSetupFailure>;
