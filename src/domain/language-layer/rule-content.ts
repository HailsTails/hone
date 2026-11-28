import type { Result } from "../result.ts";
import { ownedNameText } from "../rule-set/rule-set-identity.ts";
import type { Symptom, SymptomAddress, SymptomCatalogue } from "./symptom-catalogue.ts";

export type SymptomUnheld = { readonly kind: "symptom-unheld"; readonly symptom: SymptomAddress };

export type RuleContent<Field extends keyof Symptom = keyof Symptom> = {
  readonly symptoms: ReadonlyMap<string, Pick<Symptom, Field>>;
};

export const createRuleContent = (request: {
  readonly catalogues: readonly Pick<SymptomCatalogue, "symptoms">[];
}): RuleContent => ({
  symptoms: new Map(
    request.catalogues.flatMap((catalogue) =>
      catalogue.symptoms.map((symptom): readonly [string, Symptom] => [
        ownedNameText(symptom),
        symptom,
      ]),
    ),
  ),
});

export const mapAddressToSymptom = <Field extends keyof Symptom>(request: {
  readonly content: RuleContent<Field>;
  readonly symptom: SymptomAddress;
}): Result<Pick<Symptom, Field>, SymptomUnheld> => {
  const symptom = request.content.symptoms.get(ownedNameText(request.symptom));
  return symptom === undefined
    ? { outcome: "failed", error: { kind: "symptom-unheld", symptom: request.symptom } }
    : { outcome: "ok", value: symptom };
};
