import { NOT_ADOPTED, NOT_RUN } from "../rule-set/identifiers.ts";

export const FORFEITURE_ASSESSMENTS = ["this-run", "elsewhere"] as const;

export type ForfeitureAssessment = (typeof FORFEITURE_ASSESSMENTS)[number];

export type Assessment = { readonly forfeiture: ForfeitureAssessment };

export type AssessmentRequest = {
  readonly [Concern in keyof Assessment]: Assessment[Concern] | undefined;
};

export const assessmentInEffect = (request: {
  readonly requested: AssessmentRequest;
  readonly configured: Assessment;
}): Assessment => ({
  forfeiture: request.requested.forfeiture ?? request.configured.forfeiture,
});

export const WAIVED_CLAUSES_REPLACEMENT = `in clauses, mark a clause "${NOT_RUN}" when its mechanism does not run, or "${NOT_ADOPTED}" when its rule does not apply; see MIGRATING.md section 12`;

export const removedText = (request: {
  readonly removed: string;
  readonly instead: string;
}): string => `removed: ${JSON.stringify(request.removed)}; ${request.instead}`;
