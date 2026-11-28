import type { Result } from "../result.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import { type OwnedName, ownedNameText } from "../rule-set/rule-set-identity.ts";
import type { CheckAddressText } from "./check-address-text.ts";
import { findCheckEngine, qualifiedAddressOf, qualifiedCheckAddressOf } from "./check-address.ts";
import type {
  Check,
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

export type CheckPage =
  | { readonly resolved: "check"; readonly check: CheckAddress & Pick<CheckContent, "page"> }
  | { readonly resolved: "none" };

type CheckPageRequest = {
  readonly ruleSet: OwnedName["ruleSet"];
  readonly check: CheckAddressText;
  readonly engine: EngineId;
};

export type CheckPages = { readonly checkPage: (observation: CheckPageRequest) => CheckPage };

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
  request: CheckCatalogues<CheckAddress & Pick<Check, "page" | "engines">>,
): CheckPages => {
  const index = createCheckIndex(request);
  return {
    checkPage: ({ ruleSet, check: address, engine }) => {
      const check = index.get(qualifiedAddressOf({ ruleSet, address }));
      return check !== undefined && findCheckEngine({ check, engine }) !== undefined
        ? {
            resolved: "check",
            check: {
              name: check.name,
              symptom: { name: check.symptom.name, ruleSet: check.symptom.ruleSet },
              page: check.page,
            },
          }
        : { resolved: "none" };
    },
  };
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
