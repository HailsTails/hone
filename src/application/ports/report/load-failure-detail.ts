import type { SymptomUnheld } from "../../../domain/language-layer/rule-content.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";

export type LoadFailureDetail = (request: {
  readonly failure: LoadFailure | SymptomUnheld;
}) => string;
