import type { RuleSetIdentity } from "./clause-address-types.ts";
import { TOOL_RULE_SET } from "./clause-address.ts";
import { isRuleSetName } from "./identifiers.ts";

export const RULE_SET_SEPARATOR = "/";

export type OwnedName = { readonly ruleSet: RuleSetIdentity; readonly name: string };

export const ownedNameText = (request: OwnedName): string =>
  request.ruleSet === TOOL_RULE_SET
    ? request.name
    : `${request.ruleSet.name}${RULE_SET_SEPARATOR}${request.name}`;

export const sameOwnedName = (request: {
  readonly left: OwnedName;
  readonly right: OwnedName;
}): "same" | "different" =>
  ownedNameText(request.left) === ownedNameText(request.right) ? "same" : "different";

export const teamRuleSetOf = (request: {
  readonly name: string;
}): Exclude<RuleSetIdentity, typeof TOOL_RULE_SET> | undefined =>
  isRuleSetName(request.name) && request.name !== TOOL_RULE_SET
    ? { name: request.name }
    : undefined;

const ownerOf = (request: { readonly text: string }): RuleSetIdentity | undefined => {
  if (request.text === TOOL_RULE_SET) return TOOL_RULE_SET;
  return isRuleSetName(request.text) ? { name: request.text } : undefined;
};

const isOwnerAndName = (parts: readonly string[]): parts is readonly [string, string] =>
  parts.length === 2;

export const ownedNameOf = (request: {
  readonly text: string;
}): OwnedName | "not-an-owned-name" => {
  const parts = request.text.split(RULE_SET_SEPARATOR);
  if (!isOwnerAndName(parts)) {
    return parts.length === 1
      ? { ruleSet: TOOL_RULE_SET, name: request.text }
      : "not-an-owned-name";
  }
  const [owner, name] = parts;
  const ruleSet = ownerOf({ text: owner });
  return ruleSet === undefined || name === "" ? "not-an-owned-name" : { ruleSet, name };
};
