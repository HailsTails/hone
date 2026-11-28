import type { Result } from "../result.ts";
import { ownedNameText } from "../rule-set/rule-set-identity.ts";
import { qualifiedCheckAddressOf } from "./check-address.ts";
import type {
  CheckAddress,
  CheckContent,
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

export type CheckPages = { readonly checkPage: (address: CheckAddress) => string | undefined };

type CheckCatalogues<Content extends CheckAddress> = {
  readonly catalogues: readonly { readonly checks: readonly Content[] }[];
};

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

const createCheckIndex = <Content extends CheckAddress>(request: CheckCatalogues<Content>) =>
  createCatalogueIndex({
    catalogues: request.catalogues,
    contents: ({ checks }) => checks,
    address: (check) => qualifiedCheckAddressOf({ check }),
  });

export const createCheckMembership = (request: CheckCatalogues<CheckAddress>): CheckMembership => {
  const index = createCheckIndex(request);
  return { hasCheck: (check) => index.has(qualifiedCheckAddressOf({ check })) };
};

export const createCheckPages = (
  request: CheckCatalogues<CheckAddress & Pick<CheckContent, "page">>,
): CheckPages => {
  const index = createCheckIndex(request);
  return { checkPage: (check) => index.get(qualifiedCheckAddressOf({ check }))?.page };
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
