import { z } from "zod";
import {
  type Assessment,
  FORFEITURE_ASSESSMENTS,
  type ForfeitureAssessment,
  removedText,
  WAIVED_CLAUSES_REPLACEMENT,
} from "../../domain/settings/assessment.ts";
import type { DeepReadonly, Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const forfeitureAssessmentSchema = z.enum(FORFEITURE_ASSESSMENTS);

const ASSESSMENT_CONCERNS = {
  forfeiture: forfeitureAssessmentSchema.default("this-run"),
};

const REMOVED_CONCERNS: ReadonlyMap<string, string> = new Map([["waivedClauses", WAIVED_CLAUSES_REPLACEMENT]]);

const quotedKeys = (request: { readonly keys: readonly string[] }): string =>
  request.keys.map((key) => JSON.stringify(key)).join(", ");

const removedKeyMessages = (request: { readonly keys: readonly string[] }): readonly string[] =>
  request.keys.flatMap((key) => {
    const instead = REMOVED_CONCERNS.get(key);
    return instead === undefined ? [] : [removedText({ removed: key, instead })];
  });

const unbuiltKeyMessages = (request: { readonly keys: readonly string[] }): readonly string[] => {
  const unbuilt = request.keys.filter((key) => !REMOVED_CONCERNS.has(key));
  return unbuilt.length === 0
    ? []
    : [`not available in this version: ${quotedKeys({ keys: unbuilt })}; assessment takes ${quotedKeys({ keys: Object.keys(ASSESSMENT_CONCERNS) })} only`];
};

export const assessmentSchema = z.strictObject(ASSESSMENT_CONCERNS, {
  error: (issue) =>
    issue.code === "unrecognized_keys"
      ? [...removedKeyMessages({ keys: issue.keys }), ...unbuiltKeyMessages({ keys: issue.keys })].join(". ")
      : undefined,
});

export const DEFAULT_ASSESSMENT: Assessment = assessmentSchema.parse({});

export const isForfeitureAssessmentSchemaEqual: Equal<z.output<typeof forfeitureAssessmentSchema>, ForfeitureAssessment> = true;
export const isAssessmentSchemaEqual: Equal<DeepReadonly<z.output<typeof assessmentSchema>>, Assessment> = true;
