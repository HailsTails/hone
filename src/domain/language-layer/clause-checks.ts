import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../rule-set/clause-address.ts";
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

export type ClauseChecks = ReadonlyMap<string, readonly Check[]>;

export const createClauseChecks = (request: {
  readonly catalogues: readonly Pick<RuleSetCatalogue, "catalogue">[];
}): ClauseChecks =>
  new Map(
    request.catalogues.flatMap(({ catalogue }) =>
      catalogue.checks.flatMap((check): readonly (readonly [string, readonly Check[]])[] =>
        check.clause === undefined
          ? []
          : [
              [
                clauseAddressText({ address: check.clause }),
                checksOf({ catalogue, clause: check.clause }),
              ],
            ],
      ),
    ),
  );

export const readChecksOfClause = (request: {
  readonly clauseChecks: ClauseChecks;
  readonly clause: ClauseAddress;
}): readonly Check[] =>
  request.clauseChecks.get(clauseAddressText({ address: request.clause })) ?? [];
