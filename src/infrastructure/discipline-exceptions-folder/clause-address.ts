import { z } from "zod";
import type { ClauseAddress, ToolRuleSet } from "../../domain/rule-set/clause-address-types.ts";
import { isCatalogueName } from "../../domain/language-layer/catalogue-name.ts";
import { TOOL_RULE_SET, clauseAddressPartsOf } from "../../domain/rule-set/clause-address.ts";
import { clauseIdSchema, disciplineIdSchema, ruleSetNameSchema } from "../hone-config-file/identifiers.ts";
import type { DeepReadonly, Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const isToolRuleSetEqual: Equal<typeof TOOL_RULE_SET, ToolRuleSet> = true;

const ruleSetSchema = z.union([
  z.literal(TOOL_RULE_SET),
  z.object({ name: ruleSetNameSchema.refine((name) => name !== TOOL_RULE_SET) }),
]);

const legacyClauseAddressObjectSchema = z.object({
  ruleSet: ruleSetSchema,
  discipline: disciplineIdSchema,
  clause: clauseIdSchema,
});

const namedCheckAddressObjectSchema = z.object({
  ruleSet: ruleSetSchema,
  symptom: z.string().refine(isCatalogueName),
  check: z.string().refine(isCatalogueName),
});

export const clauseAddressObjectSchema = z.union([legacyClauseAddressObjectSchema, namedCheckAddressObjectSchema]);

export const isClauseAddressObjectSchemaEqual: Equal<
  DeepReadonly<z.output<typeof clauseAddressObjectSchema>>,
  ClauseAddress
> = true;

export const clauseAddressSchema = z
  .string()
  .transform((text, context) => {
    const parts = clauseAddressPartsOf({ text });
    if (parts === "not-a-clause-address") {
      context.addIssue({
        code: "custom",
        message: "is not a clause address of the form [<ruleSet>/]<discipline>#<clause>",
      });
      return z.NEVER;
    }
    return parts;
  })
  .pipe(legacyClauseAddressObjectSchema);

export const registeredAddressSchema = z.union([clauseAddressSchema, namedCheckAddressObjectSchema]);
