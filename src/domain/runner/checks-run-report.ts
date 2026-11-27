import type { RepoPath } from "../repository/repo-path-types.ts";
import type { RuleSetIdentity } from "../rule-set/clause-address-types.ts";

export type ProjectionEntry =
  | { readonly kind: "write"; readonly file: RepoPath; readonly text: string }
  | { readonly kind: "remove"; readonly file: RepoPath };

export type ProjectedFile = Extract<ProjectionEntry, { readonly kind: "write" }>;

export type AnsweredFile = {
  readonly ruleSet: RuleSetIdentity;
  readonly symptom: string;
  readonly check?: string;
  readonly file: RepoPath;
};

export type NonEmptyRuleIds = readonly [string, ...string[]];

export type MisnamedRuleId =
  | {
      readonly kind: "names-no-check";
      readonly ruleId: string;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
    }
  | {
      readonly kind: "version-1-id";
      readonly ruleId: string;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
      readonly replacedBy: NonEmptyRuleIds;
    };

export type MisnamedRuleIdKind = MisnamedRuleId["kind"];

export type ChecksProjectionProblem =
  | ChecksSliceProblem
  | { readonly state: "left-over"; readonly file: RepoPath };

export type ChecksSliceProblem = {
  readonly file: RepoPath;
  readonly state: "missing" | "out-of-date" | "not-applied" | "unconfigured";
};
