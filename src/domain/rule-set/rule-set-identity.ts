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

const ownerOf = (request: { readonly text: string }): RuleSetIdentity | undefined => {
  if (request.text === TOOL_RULE_SET) return TOOL_RULE_SET;
  return isRuleSetName(request.text) ? { name: request.text } : undefined;
};

export const ownedNameOf = (request: {
  readonly text: string;
}): OwnedName | "not-an-owned-name" => {
  const [first, name, ...rest] = request.text.split(RULE_SET_SEPARATOR);
  if (name === undefined) return { ruleSet: TOOL_RULE_SET, name: request.text };
  const ruleSet = ownerOf({ text: first ?? "" });
  return ruleSet === undefined || rest.length > 0 || name === ""
    ? "not-an-owned-name"
    : { ruleSet, name };
};
