import type { ClauseId, DisciplineId, RuleSetName } from "./identifier-types.ts";

export type ToolRuleSet = "hone";

export type RuleSetIdentity = ToolRuleSet | { readonly name: RuleSetName };

export type ClauseAddress = {
  readonly ruleSet: RuleSetIdentity;
  readonly discipline: DisciplineId;
  readonly clause: ClauseId;
};
