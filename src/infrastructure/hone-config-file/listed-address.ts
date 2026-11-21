import { z } from "zod";
import type { ClauseAddress } from "../discipline-exceptions-folder/clause-address.ts";
import { TOOL_RULE_SET } from "../discipline-exceptions-folder/clause-address.ts";
import { ruleSetNameSchema } from "./identifiers.ts";

export type ListedAddress = { readonly ruleSet: ClauseAddress["ruleSet"]; readonly check: string };

const LISTED_ADDRESS_TEXT = /^(?:(?<ruleSet>[^/#]+)\/)?(?<check>[^/#]+#[^/#]+)$/;

const NOT_A_LISTED_ADDRESS = "is not a check address of the form [<ruleSet>/]<symptom>#<check>";

const ruleSetOf = (request: { readonly name: string | undefined }): ClauseAddress["ruleSet"] | undefined => {
  if (request.name === undefined || request.name === TOOL_RULE_SET) {
    return TOOL_RULE_SET;
  }
  const name = ruleSetNameSchema.safeParse(request.name);
  return name.success ? { name: name.data } : undefined;
};

export const listedAddressSchema = z.string().transform((text, context): ListedAddress => {
  const parts = LISTED_ADDRESS_TEXT.exec(text)?.groups;
  const check = parts?.check;
  const ruleSet = ruleSetOf({ name: parts?.ruleSet });
  if (check === undefined || ruleSet === undefined) {
    context.addIssue({ code: "custom", message: NOT_A_LISTED_ADDRESS });
    return z.NEVER;
  }
  return { ruleSet, check };
});

export const listedAddressText = (request: { readonly address: ListedAddress }): string =>
  request.address.ruleSet === TOOL_RULE_SET ? request.address.check : `${request.address.ruleSet.name}/${request.address.check}`;

export const sameListedAddress = (request: { readonly left: ListedAddress; readonly right: ListedAddress }): "same" | "different" =>
  listedAddressText({ address: request.left }) === listedAddressText({ address: request.right }) ? "same" : "different";
