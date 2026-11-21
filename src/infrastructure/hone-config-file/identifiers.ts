import { z } from "zod";
import { brandedTextSchema } from "../content-files/branded-schema.ts";
import type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "../../domain/rule-set/identifier-types.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "../../domain/rule-set/identifier-types.ts";

const RULE_SET_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const DISCIPLINE_ID_PATTERN = /^[A-Z]{2,4}-[0-9]+[a-z]?$/;
const CLAUSE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const MECHANISM_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const NOT_AN_IDENTIFIER = "not an identifier of its kind";

export const NOT_RUN = "not-run";

export const NOT_ADOPTED = "not-adopted";

const RESERVED_CLAUSE_STATES: ReadonlyMap<string, string> = new Map([
  [NOT_RUN, "a clause adopted with its mechanism not run"],
  [NOT_ADOPTED, "a clause a repository does not adopt"],
]);

const isRuleSetName = (text: string): text is RuleSetName => RULE_SET_NAME_PATTERN.test(text);
const isDisciplineId = (text: string): text is DisciplineId => DISCIPLINE_ID_PATTERN.test(text);
const isClauseId = (text: string): text is ClauseId => CLAUSE_ID_PATTERN.test(text);
const isMechanismId = (text: string): text is MechanismId =>
  MECHANISM_ID_PATTERN.test(text) && !RESERVED_CLAUSE_STATES.has(text);

export const ruleSetNameSchema = brandedTextSchema({
  text: z.string().regex(RULE_SET_NAME_PATTERN),
  isBranded: isRuleSetName,
  refusal: NOT_AN_IDENTIFIER,
});
export const disciplineIdSchema = brandedTextSchema({
  text: z.string().regex(DISCIPLINE_ID_PATTERN),
  isBranded: isDisciplineId,
  refusal: NOT_AN_IDENTIFIER,
});
export const clauseIdSchema = brandedTextSchema({
  text: z.string().regex(CLAUSE_ID_PATTERN),
  isBranded: isClauseId,
  refusal: NOT_AN_IDENTIFIER,
});
export const mechanismIdSchema = brandedTextSchema({
  text: z
    .string()
    .regex(MECHANISM_ID_PATTERN)
    .superRefine((text, context) => {
      const reservedFor = RESERVED_CLAUSE_STATES.get(text);
      if (reservedFor !== undefined) {
        context.addIssue({ code: "custom", message: `"${text}" is reserved for ${reservedFor}, so it cannot name a mechanism` });
      }
    }),
  isBranded: isMechanismId,
  refusal: NOT_AN_IDENTIFIER,
});

export const isRuleSetNameSchemaEqual: Equal<z.output<typeof ruleSetNameSchema>, RuleSetName> = true;
export const isDisciplineIdSchemaEqual: Equal<z.output<typeof disciplineIdSchema>, DisciplineId> = true;
export const isClauseIdSchemaEqual: Equal<z.output<typeof clauseIdSchema>, ClauseId> = true;
export const isMechanismIdSchemaEqual: Equal<z.output<typeof mechanismIdSchema>, MechanismId> = true;
