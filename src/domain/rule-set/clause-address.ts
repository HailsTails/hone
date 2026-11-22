import type { ClauseAddress } from "./clause-address-types.ts";
import { isClauseId, isDisciplineId, isRuleSetName } from "./identifiers.ts";
import { TOOL_IDENTITY } from "./tool-identity.ts";

export const TOOL_RULE_SET = TOOL_IDENTITY.ownRuleSet;

export type ClauseAddressParts = {
  readonly ruleSet: typeof TOOL_RULE_SET | { readonly name: string };
  readonly discipline: string;
  readonly clause: string;
};

const CLAUSE_ADDRESS_TEXT = /^(?:(?<ruleSet>[^/#]+)\/)?(?<discipline>[^/#]+)#(?<clause>[^/#]+)$/;

export const clauseAddressPartsOf = (request: {
  readonly text: string;
}): ClauseAddressParts | "not-a-clause-address" => {
  const parts = CLAUSE_ADDRESS_TEXT.exec(request.text)?.groups;
  const discipline = parts?.discipline;
  const clause = parts?.clause;
  if (discipline === undefined || clause === undefined) {
    return "not-a-clause-address";
  }
  return {
    ruleSet:
      parts?.ruleSet === undefined || parts.ruleSet === TOOL_RULE_SET
        ? TOOL_RULE_SET
        : { name: parts.ruleSet },
    discipline,
    clause,
  };
};

const ruleSetOf = (request: {
  readonly ruleSet: ClauseAddressParts["ruleSet"];
}): ClauseAddress["ruleSet"] | undefined => {
  if (request.ruleSet === TOOL_RULE_SET) {
    return TOOL_RULE_SET;
  }
  return isRuleSetName(request.ruleSet.name) && request.ruleSet.name !== TOOL_RULE_SET
    ? { name: request.ruleSet.name }
    : undefined;
};

export const clauseAddressOf = (request: {
  readonly text: string;
}): ClauseAddress | "not-a-clause-address" => {
  const parts = clauseAddressPartsOf(request);
  if (parts === "not-a-clause-address") {
    return parts;
  }
  const ruleSet = ruleSetOf({ ruleSet: parts.ruleSet });
  return ruleSet !== undefined && isDisciplineId(parts.discipline) && isClauseId(parts.clause)
    ? { ruleSet, discipline: parts.discipline, clause: parts.clause }
    : "not-a-clause-address";
};

export const clauseAddressText = (request: { readonly address: ClauseAddress }): string =>
  request.address.ruleSet === TOOL_RULE_SET
    ? `${request.address.discipline}#${request.address.clause}`
    : `${request.address.ruleSet.name}/${request.address.discipline}#${request.address.clause}`;

export const sameClauseAddress = (request: {
  readonly left: ClauseAddress;
  readonly right: ClauseAddress;
}): "same" | "different" =>
  clauseAddressText({ address: request.left }) === clauseAddressText({ address: request.right })
    ? "same"
    : "different";
