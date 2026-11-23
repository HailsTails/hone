import type { RuleSetIdentity } from "./clause-address-types.ts";
import { TOOL_RULE_SET } from "./clause-address.ts";

export const RULE_SET_SEPARATOR = "/";

export const ownedNameText = (request: {
  readonly ruleSet: RuleSetIdentity;
  readonly name: string;
}): string =>
  request.ruleSet === TOOL_RULE_SET
    ? request.name
    : `${request.ruleSet.name}${RULE_SET_SEPARATOR}${request.name}`;

export const sameOwnedName = (request: {
  readonly left: { readonly ruleSet: RuleSetIdentity; readonly name: string };
  readonly right: { readonly ruleSet: RuleSetIdentity; readonly name: string };
}): "same" | "different" =>
  ownedNameText(request.left) === ownedNameText(request.right) ? "same" : "different";
