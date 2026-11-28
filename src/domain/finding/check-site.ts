import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import { qualifiedAddressOf, qualifiedCheckAddressOf } from "../language-layer/check-address.ts";
import type { CheckPage, CheckPages } from "../language-layer/rule-content.ts";
import type { CheckAddress, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import { resolveObservedCheck } from "./finding-check.ts";
import type { AttributedCheckException, CheckFinding } from "./governance.ts";

export type CheckSite =
  | { readonly sited: "check"; readonly address: CheckAddress; readonly mechanism: EngineId }
  | {
      readonly sited: "unchecked-check";
      readonly address: CheckAddressText;
      readonly mechanism: EngineId;
    };

type CheckedAddress = Pick<CheckFinding, "check" | "mechanism" | "ruleSet">;

const createCheckSite = (request: {
  readonly resolved:
    | { readonly resolved: "check"; readonly check: CheckAddress }
    | { readonly resolved: "none" };
  readonly observation: CheckedAddress;
}): CheckSite => {
  const {
    resolved,
    observation: { mechanism, check: address, ruleSet },
  } = request;
  if (resolved.resolved === "none") {
    return {
      sited: "unchecked-check",
      address: qualifiedAddressOf({ ruleSet, address }),
      mechanism,
    };
  }
  const { name, symptom } = resolved.check;
  return {
    sited: "check",
    address: { name, symptom: { name: symptom.name, ruleSet: symptom.ruleSet } },
    mechanism,
  };
};

export const findingSiteOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: CheckedAddress;
}): CheckSite =>
  createCheckSite({
    resolved: resolveObservedCheck({ catalogue: request.catalogue, observation: request.finding }),
    observation: request.finding,
  });

export const locateRenderedFinding = (request: {
  readonly finding: CheckedAddress;
  readonly pages: CheckPages;
}): { readonly site: CheckSite; readonly page: CheckPage } => {
  const { finding } = request;
  const page = request.pages.checkPage({ ...finding, engine: finding.mechanism });
  return { site: createCheckSite({ resolved: page, observation: finding }), page };
};

export const locateNativeException = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: AttributedCheckException;
}): CheckSite =>
  createCheckSite({
    resolved: resolveObservedCheck({
      catalogue: request.catalogue,
      observation: request.exception,
    }),
    observation: request.exception,
  });

export const nativeSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: AttributedCheckException;
}): readonly CheckSite[] => [locateNativeException(request)];

export const checkSiteText = ({ site }: { readonly site: CheckSite }): string =>
  `${site.sited === "check" ? qualifiedCheckAddressOf({ check: site.address }) : site.address} ${site.mechanism}`;
