import { catalogueOf, type RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { checksOf } from "../../../domain/language-layer/check-address.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { ClauseAddress } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";

export const checksOfClause = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly clause: ClauseAddress;
}): readonly Check[] => {
  const catalogue = catalogueOf({ catalogues: request.catalogues, ruleSet: request.clause.ruleSet });
  return catalogue === undefined ? [] : checksOf({ catalogue, clause: request.clause });
};
