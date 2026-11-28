import { qualifiedAddressOf, qualifiedCheckAddressOf } from "../language-layer/check-address.ts";
import type { Check, Engine, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import { checkOfFinding, checkOfNativeException, type FindingCheck } from "./finding-check.ts";
import type { AttributedCheckException, CheckFinding } from "./governance.ts";

export type CheckSite =
  | { readonly sited: "check"; readonly check: Check; readonly engine: Engine }
  | {
      readonly sited: "unchecked-check";
      readonly address: string;
      readonly mechanism: EngineId;
    };

const mapFindingCheckToSite = (request: {
  readonly resolved: FindingCheck;
  readonly address: string;
  readonly mechanism: EngineId;
}): CheckSite =>
  request.resolved.resolved === "check"
    ? { sited: "check", check: request.resolved.check, engine: request.resolved.engine }
    : { sited: "unchecked-check", address: request.address, mechanism: request.mechanism };

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
  site.sited === "check"
    ? `${qualifiedCheckAddressOf({ check: site.check })} ${site.engine.name}`
    : `${site.address} ${site.mechanism}`;
