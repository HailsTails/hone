import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";

export const ASSESSMENT_FILE_NAME = "disciplines.assessment.md";

export const assessmentSectionHeading = (request: { readonly clause: ClauseAddress }): string =>
  `## ${clauseAddressText({ address: request.clause })}`;
