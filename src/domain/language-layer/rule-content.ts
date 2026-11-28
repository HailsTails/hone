import type { Result } from "../result.ts";
import { ownedNameText } from "../rule-set/rule-set-identity.ts";
import { qualifiedCheckAddressOf } from "./check-address.ts";
import type {
  CheckAddress,
  Symptom,
  SymptomAddress,
  SymptomCatalogue,
} from "./symptom-catalogue.ts";

export type SymptomUnheld = { readonly kind: "symptom-unheld"; readonly symptom: SymptomAddress };

export type RuleContent<Field extends keyof Symptom = keyof Symptom> = {
  readonly symptoms: ReadonlyMap<string, Pick<Symptom, Field>>;
};

type SymptomCatalogues = { readonly catalogues: readonly Pick<SymptomCatalogue, "symptoms">[] };

export type CheckMembership = { readonly hasCheck: ReadonlySet<CheckAddress>["has"] };

const createCatalogueIndex = <Catalogue, Content>(request: {
  readonly catalogues: readonly Catalogue[];
  readonly contents: (catalogue: Catalogue) => readonly Content[];
  readonly address: (content: Content) => string;
}): ReadonlyMap<string, Content> =>
  new Map(
    request.catalogues.flatMap((catalogue) =>
      request
        .contents(catalogue)
        .map((content): readonly [string, Content] => [request.address(content), content]),
    ),
  );

export const createCheckMembership = (request: {
  readonly catalogues: readonly { readonly checks: readonly CheckAddress[] }[];
}): CheckMembership => {
  const index = createCatalogueIndex({
    catalogues: request.catalogues,
    contents: ({ checks }) => checks,
    address: (check) => qualifiedCheckAddressOf({ check }),
  });
  return { hasCheck: (check) => index.has(qualifiedCheckAddressOf({ check })) };
};

export const createRuleContent = (request: SymptomCatalogues): RuleContent => ({
  symptoms: createCatalogueIndex({
    catalogues: request.catalogues,
    contents: ({ symptoms }) => symptoms,
    address: ownedNameText,
  }),
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
