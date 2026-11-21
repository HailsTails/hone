import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { isRuleSetName } from "../rule-set/identifiers.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";

export type ListedAddress = { readonly ruleSet: ClauseAddress["ruleSet"]; readonly check: string };

const LISTED_ADDRESS_TEXT = /^(?:(?<ruleSet>[^/#]+)\/)?(?<check>[^/#]+#[^/#]+)$/;

const ruleSetOf = (request: { readonly name: string | undefined }): ClauseAddress["ruleSet"] | undefined => {
  if (request.name === undefined || request.name === TOOL_RULE_SET) {
    return TOOL_RULE_SET;
  }
  return isRuleSetName(request.name) ? { name: request.name } : undefined;
};

export const listedAddressOf = (request: { readonly text: string }): ListedAddress | undefined => {
  const parts = LISTED_ADDRESS_TEXT.exec(request.text)?.groups;
  const check = parts?.check;
  const ruleSet = ruleSetOf({ name: parts?.ruleSet });
  return check === undefined || ruleSet === undefined ? undefined : { ruleSet, check };
};

export const listedAddressText = (request: { readonly address: ListedAddress }): string =>
  request.address.ruleSet === TOOL_RULE_SET ? request.address.check : `${request.address.ruleSet.name}/${request.address.check}`;

export const sameListedAddress = (request: { readonly left: ListedAddress; readonly right: ListedAddress }): "same" | "different" =>
  listedAddressText({ address: request.left }) === listedAddressText({ address: request.right }) ? "same" : "different";
