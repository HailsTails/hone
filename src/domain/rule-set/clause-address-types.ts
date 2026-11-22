import type { CatalogueName } from "../language-layer/catalogue-name.ts";
import type { ClauseId, DisciplineId, RuleSetName } from "./identifier-types.ts";

export type ToolRuleSet = "hone";

export type AddressRuleSet = ToolRuleSet | { readonly name: RuleSetName };

export type LegacyClauseAddress = {
  readonly ruleSet: AddressRuleSet;
  readonly discipline: DisciplineId;
  readonly clause: ClauseId;
};

export type NamedCheckAddress = {
  readonly ruleSet: AddressRuleSet;
  readonly symptom: CatalogueName;
  readonly check: CatalogueName;
};

export type ClauseAddress = LegacyClauseAddress | NamedCheckAddress;
