import { NOT_ADOPTED, NOT_RUN } from "../rule-set/identifiers.ts";

export const FORFEITURE_ASSESSMENTS = ["this-run", "elsewhere"] as const;

export const CHECK_FORFEITURE_ASSESSMENTS = [...FORFEITURE_ASSESSMENTS, "no-new-findings"] as const;

export type ForfeitureAssessment = (typeof FORFEITURE_ASSESSMENTS)[number];
export type CheckForfeiture = (typeof CHECK_FORFEITURE_ASSESSMENTS)[number];

export type Assessment<Policy extends CheckForfeiture = ForfeitureAssessment> = {
  readonly forfeiture: Policy;
};

export type AssessmentRequest<
  Policy extends CheckForfeiture | undefined = ForfeitureAssessment | undefined,
> = {
  readonly forfeiture: Policy;
};

export const assessmentInEffect = <Policy extends CheckForfeiture | undefined>(request: {
  readonly requested: AssessmentRequest<Policy>;
  readonly configured: Assessment;
}): Assessment<NonNullable<Policy> | ForfeitureAssessment> => ({
  forfeiture: request.requested.forfeiture ?? request.configured.forfeiture,
});

export const WAIVED_CLAUSES_REPLACEMENT = `in clauses, mark a clause "${NOT_RUN}" when its mechanism does not run, or "${NOT_ADOPTED}" when its rule does not apply; see MIGRATING.md section 12`;

export const removedText = (request: {
  readonly removed: string;
  readonly instead: string;
}): string => `removed: ${JSON.stringify(request.removed)}; ${request.instead}`;
