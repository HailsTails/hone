import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { CatalogueHolding } from "../../domain/language-layer/symptom-catalogue.ts";

export type SymptomCatalogueRepository = {
  readonly read: (request: Record<string, never>) => Result<CatalogueHolding, VersionTwoLoadFailure>;
};
