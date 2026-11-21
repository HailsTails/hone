import type { RuleSetCatalogue } from "../src/domain/settings/check-choices.ts";
import type { Check } from "../src/domain/language-layer/symptom-catalogue.ts";

export const shippedCheckOf = (request: { readonly catalogues: readonly RuleSetCatalogue[]; readonly discipline: string; readonly name: string }): Check => {
  const [only, ...others] = request.catalogues.flatMap(({ catalogue }) =>
    catalogue.checks.filter((check) => check.name === request.name && check.clause.discipline === request.discipline),
  );
  if (only === undefined || others.length > 0) {
    throw new Error(`the shipped catalogue does not hold exactly one ${request.name} check of ${request.discipline}`);
  }
  return only;
};
