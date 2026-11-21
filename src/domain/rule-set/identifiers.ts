import type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "./identifier-types.ts";

export const RULE_SET_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
export const DISCIPLINE_ID_PATTERN = /^[A-Z]{2,4}-[0-9]+[a-z]?$/;
export const CLAUSE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const MECHANISM_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const NOT_RUN = "not-run";

export const NOT_ADOPTED = "not-adopted";

export const RESERVED_CLAUSE_STATES: ReadonlyMap<string, string> = new Map([
  [NOT_RUN, "a clause adopted with its mechanism not run"],
  [NOT_ADOPTED, "a clause a repository does not adopt"],
]);

export const isRuleSetName = (text: string): text is RuleSetName => RULE_SET_NAME_PATTERN.test(text);
export const isDisciplineId = (text: string): text is DisciplineId => DISCIPLINE_ID_PATTERN.test(text);
export const isClauseId = (text: string): text is ClauseId => CLAUSE_ID_PATTERN.test(text);
export const isMechanismId = (text: string): text is MechanismId =>
  MECHANISM_ID_PATTERN.test(text) && !RESERVED_CLAUSE_STATES.has(text);
