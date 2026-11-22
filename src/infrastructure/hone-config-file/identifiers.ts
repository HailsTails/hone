import { z } from "zod";
import { brandedTextSchema } from "../content-files/branded-schema.ts";
import type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "../../domain/rule-set/identifier-types.ts";
import { isClauseId, isDisciplineId, isRuleSetName } from "../../domain/rule-set/identifiers.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

const NOT_AN_IDENTIFIER = "not an identifier of its kind";

export const ruleSetNameSchema = brandedTextSchema({
  text: z.string(),
  isBranded: isRuleSetName,
  refusal: NOT_AN_IDENTIFIER,
});
export const disciplineIdSchema = brandedTextSchema({
  text: z.string(),
  isBranded: isDisciplineId,
  refusal: NOT_AN_IDENTIFIER,
});
export const clauseIdSchema = brandedTextSchema({
  text: z.string(),
  isBranded: isClauseId,
  refusal: NOT_AN_IDENTIFIER,
});
export const mechanismIdSchema = z.enum(["audit", "eslint"]);

export const isRuleSetNameSchemaEqual: Equal<z.output<typeof ruleSetNameSchema>, RuleSetName> = true;
export const isDisciplineIdSchemaEqual: Equal<z.output<typeof disciplineIdSchema>, DisciplineId> = true;
export const isClauseIdSchemaEqual: Equal<z.output<typeof clauseIdSchema>, ClauseId> = true;
export const isMechanismIdSchemaEqual: Equal<z.output<typeof mechanismIdSchema>, MechanismId> = true;
