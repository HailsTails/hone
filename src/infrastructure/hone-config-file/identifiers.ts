import { z } from "zod";

import type { RuleSetIdentity } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import {
  ENGINE_IDS,
  type ClauseId,
  type DisciplineId,
  type EngineId,
  type RuleSetName,
} from "../../domain/rule-set/identifier-types.ts";
import { isClauseId, isDisciplineId, isRuleSetName } from "../../domain/rule-set/identifiers.ts";
import { brandedTextSchema } from "../content-files/branded-schema.ts";
import type { DeepReadonly, Equal } from "../engines/protocol/runner-module/type-equality.ts";

const NOT_AN_IDENTIFIER = "not an identifier of its kind";

export const ruleSetNameSchema = brandedTextSchema({
  text: z.string(),
  isBranded: isRuleSetName,
  refusal: NOT_AN_IDENTIFIER,
});
export const ruleSetIdentitySchema = z.union([
  z.literal(TOOL_RULE_SET),
  z.strictObject({ name: ruleSetNameSchema.refine((name) => name !== TOOL_RULE_SET) }),
]);
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
export const engineIdSchema = z.enum(ENGINE_IDS);

export const versionOneEngineIdSchema = z.union([
  engineIdSchema.exclude(["oxlint"]),
  z.literal("audit").transform((): EngineId => "walker"),
]);

export const isRuleSetNameSchemaEqual: Equal<
  z.output<typeof ruleSetNameSchema>,
  RuleSetName
> = true;
export const isDisciplineIdSchemaEqual: Equal<
  z.output<typeof disciplineIdSchema>,
  DisciplineId
> = true;
export const isClauseIdSchemaEqual: Equal<z.output<typeof clauseIdSchema>, ClauseId> = true;
export const isEngineIdSchemaEqual: Equal<z.output<typeof engineIdSchema>, EngineId> = true;
export const isRuleSetIdentitySchemaEqual: Equal<
  DeepReadonly<z.output<typeof ruleSetIdentitySchema>>,
  RuleSetIdentity
> = true;
