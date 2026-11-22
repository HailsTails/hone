import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { catalogueOf, type RuleSetCatalogue } from "../settings/check-choices.ts";
import { checksOf } from "./check-address.ts";
import type { Check } from "./symptom-catalogue.ts";

export const checksOfClause = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly clause: ClauseAddress;
}): readonly Check[] => {
  const catalogue = catalogueOf({
    catalogues: request.catalogues,
    ruleSet: request.clause.ruleSet,
  });
  return catalogue === undefined ? [] : checksOf({ catalogue, clause: request.clause });
};
