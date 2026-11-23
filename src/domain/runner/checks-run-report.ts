import type { RepoPath } from "../repository/repo-path-types.ts";
import type { RuleSetIdentity } from "../rule-set/clause-address-types.ts";

export type ProjectedFile = { readonly file: RepoPath; readonly text: string };

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

export type ChecksSliceProblem = {
  readonly slice: RepoPath;
  readonly state: "missing" | "out-of-date" | "unconfigured";
};

export type NotReadyYetFailure = {
  readonly kind: "not-ready-yet";
  readonly what: { readonly thing: "eslint-config-roots"; readonly paths: readonly string[] };
};
