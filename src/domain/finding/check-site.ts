import { qualifiedAddressOf, qualifiedCheckAddressOf } from "../language-layer/check-address.ts";
import type { CheckAddress, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import { checkOfFinding, checkOfNativeException, type FindingCheck } from "./finding-check.ts";
import type { AttributedCheckException, CheckFinding } from "./governance.ts";

export type CheckSite =
  | { readonly sited: "check"; readonly address: CheckAddress; readonly mechanism: EngineId }
  | {
      readonly sited: "unchecked-check";
      readonly address: string;
      readonly mechanism: EngineId;
    };

const mapFindingCheckToSite = (request: {
  readonly resolved: FindingCheck;
  readonly address: string;
  readonly mechanism: EngineId;
}): CheckSite => {
  const { resolved, address, mechanism } = request;
  if (resolved.resolved === "none") return { sited: "unchecked-check", address, mechanism };
  const { name, symptom } = resolved.check;
  return {
    sited: "check",
    address: { name, symptom: { name: symptom.name, ruleSet: symptom.ruleSet } },
    mechanism,
  };
};

export const findingSiteOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Pick<CheckFinding, "check" | "mechanism" | "ruleSet">;
}): CheckSite =>
  mapFindingCheckToSite({
    resolved: checkOfFinding(request),
    address: qualifiedAddressOf({
      ruleSet: request.finding.ruleSet,
      address: request.finding.check,
    }),
    mechanism: request.finding.mechanism,
  });

export const nativeSiteOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: AttributedCheckException;
}): CheckSite =>
  mapFindingCheckToSite({
    resolved: checkOfNativeException(request),
    address: request.exception.check,
    mechanism: request.exception.mechanism,
  });

export const nativeSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: AttributedCheckException;
}): readonly CheckSite[] => [nativeSiteOf(request)];

export const checkSiteText = ({ site }: { readonly site: CheckSite }): string =>
  `${site.sited === "check" ? qualifiedCheckAddressOf({ check: site.address }) : site.address} ${site.mechanism}`;
