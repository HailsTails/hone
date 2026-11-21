import { type ClauseAddress, clauseAddressText } from "../discipline-exceptions-folder/clause-address.ts";

export const ASSESSMENT_FILE_NAME = "disciplines.assessment.md";

export const assessmentSectionHeading = (request: { readonly clause: ClauseAddress }): string =>
  `## ${clauseAddressText({ address: request.clause })}`;
