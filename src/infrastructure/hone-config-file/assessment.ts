import { z } from "zod";
import { NOT_ADOPTED, NOT_RUN } from "./identifiers.ts";

export const forfeitureAssessmentSchema = z.enum(["this-run", "elsewhere"]);

export type ForfeitureAssessment = z.infer<typeof forfeitureAssessmentSchema>;

const ASSESSMENT_CONCERNS = {
  forfeiture: forfeitureAssessmentSchema.default("this-run"),
};

export const WAIVED_CLAUSES_REPLACEMENT = `in clauses, mark a clause "${NOT_RUN}" when its mechanism does not run, or "${NOT_ADOPTED}" when its rule does not apply; see MIGRATING.md section 12`;

export const removedText = (request: { readonly removed: string; readonly instead: string }): string =>
  `removed: ${JSON.stringify(request.removed)}; ${request.instead}`;

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

export type Assessment = z.infer<typeof assessmentSchema>;

export type AssessmentRequest = {
  readonly [Concern in keyof Assessment]: Assessment[Concern] | undefined;
};

export const DEFAULT_ASSESSMENT: Assessment = assessmentSchema.parse({});

export const assessmentInEffect = (request: {
  readonly requested: AssessmentRequest;
  readonly configured: Assessment;
}): Assessment => ({
  forfeiture: request.requested.forfeiture ?? request.configured.forfeiture,
});
