import { z } from "zod";
import type { ClauseAddress, ToolRuleSet } from "../../domain/rule-set/clause-address-types.ts";
import { clauseIdSchema, disciplineIdSchema, ruleSetNameSchema } from "../hone-config-file/identifiers.ts";
import { TOOL_IDENTITY } from "../../domain/rule-set/tool-identity.ts";
import type { DeepReadonly, Equal } from "../engines/protocol/runner-module/type-equality.ts";

export type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";

export const TOOL_RULE_SET = TOOL_IDENTITY.ownRuleSet;

export const isToolRuleSetEqual: Equal<typeof TOOL_RULE_SET, ToolRuleSet> = true;

const CLAUSE_ADDRESS_TEXT = /^(?:(?<ruleSet>[^/#]+)\/)?(?<discipline>[^/#]+)#(?<clause>[^/#]+)$/;

export const clauseAddressObjectSchema = z.object({
  ruleSet: z.union([
    z.literal(TOOL_RULE_SET),
    z.object({
      name: ruleSetNameSchema.refine((name) => name !== TOOL_RULE_SET),
    }),
  ]),
  discipline: disciplineIdSchema,
  clause: clauseIdSchema,
});

export const isClauseAddressObjectSchemaEqual: Equal<
  DeepReadonly<z.output<typeof clauseAddressObjectSchema>>,
  ClauseAddress
> = true;

export const clauseAddressSchema = z
  .string()
  .transform((text, context) => {
    const parts = CLAUSE_ADDRESS_TEXT.exec(text)?.groups;
    if (parts === undefined) {
      context.addIssue({
        code: "custom",
        message: "is not a clause address of the form [<ruleSet>/]<discipline>#<clause>",
      });
      return z.NEVER;
    }
    return {
      ruleSet:
        parts.ruleSet === undefined || parts.ruleSet === TOOL_RULE_SET
          ? TOOL_RULE_SET
          : { name: parts.ruleSet },
      discipline: parts.discipline,
      clause: parts.clause,
    };
  })
  .pipe(clauseAddressObjectSchema);

export const clauseAddressText = (request: {
  readonly address: ClauseAddress;
}): string =>
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
