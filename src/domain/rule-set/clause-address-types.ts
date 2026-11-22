import type { ClauseId, DisciplineId, RuleSetName } from "./identifier-types.ts";

export type ToolRuleSet = "hone";

export type ClauseAddress = {
  readonly ruleSet: ToolRuleSet | { readonly name: RuleSetName };
  readonly discipline: DisciplineId;
  readonly clause: ClauseId;
};
