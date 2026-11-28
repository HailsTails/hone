import type { Result } from "../result.ts";
import { ownedNameText } from "../rule-set/rule-set-identity.ts";
import { qualifiedCheckAddressOf } from "./check-address.ts";
import type {
  CatalogueContent,
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

type CatalogueWithChecks = Pick<CatalogueContent, "symptoms" | "checks">;

type CatalogueContents = { readonly catalogueContents: readonly CatalogueWithChecks[] };

type CheckUnheld = { readonly kind: "check-unheld"; readonly check: CheckAddress };

export type RuleContentChecks = {
  readonly check: (address: CheckAddress) => Result<CheckContent, CheckUnheld>;
};

const createCatalogueIndex = <Catalogue, Content>(request: {
  readonly catalogues: readonly Catalogue[];
  readonly contents: (catalogue: Catalogue) => readonly Content[];
  readonly address: (content: Content) => string;
}): ReadonlyMap<string, Content> =>
  new Map(
    request.catalogues.flatMap((catalogue) =>
      request.contents(catalogue).map((content): readonly [string, Content] => [
        request.address(content),
        content,
      ]),
    ),
  );

const createCheckLookup = (
  catalogues: readonly CatalogueWithChecks[],
): RuleContentChecks["check"] => {
  const checks = createCatalogueIndex({
    catalogues,
    contents: ({ checks }) => checks,
    address: (check) => qualifiedCheckAddressOf({ check }),
  });
  return (address) => {
    const check = checks.get(qualifiedCheckAddressOf({ check: address }));
    return check === undefined
      ? { outcome: "failed", error: { kind: "check-unheld", check: address } }
      : { outcome: "ok", value: check };
  };
};

export function createRuleContent(request: CatalogueContents): RuleContent & RuleContentChecks;
export function createRuleContent(request: SymptomCatalogues): RuleContent;
export function createRuleContent(
  request: CatalogueContents | SymptomCatalogues,
): RuleContent | (RuleContent & RuleContentChecks) {
  const catalogues = "catalogueContents" in request ? request.catalogueContents : request.catalogues;
  const symptoms = createCatalogueIndex({
    catalogues,
    contents: ({ symptoms }) => symptoms,
    address: ownedNameText,
  });
  return "catalogueContents" in request
    ? { symptoms, check: createCheckLookup(request.catalogueContents) }
    : { symptoms };
}

export const mapAddressToSymptom = <Field extends keyof Symptom>(request: {
  readonly content: RuleContent<Field>;
  readonly symptom: SymptomAddress;
}): Result<Pick<Symptom, Field>, SymptomUnheld> => {
  const symptom = request.content.symptoms.get(ownedNameText(request.symptom));
  return symptom === undefined
    ? { outcome: "failed", error: { kind: "symptom-unheld", symptom: request.symptom } }
    : { outcome: "ok", value: symptom };
};
