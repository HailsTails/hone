import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import { qualifiedCheckAddressOf } from "../language-layer/check-address.ts";
import type { Check, Engine, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import { checkOfFinding } from "./finding-check.ts";
import type { AttributedCheckException, CheckFinding } from "./governance.ts";

export type CheckSite =
  | { readonly sited: "check"; readonly check: Check; readonly engine: Engine }
  | {
      readonly sited: "unchecked-check";
      readonly address: CheckAddressText;
      readonly mechanism: EngineId;
    };

export const findingSiteOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Pick<CheckFinding, "check" | "mechanism">;
}): CheckSite => {
  const { finding } = request;
  const resolved = checkOfFinding(request);
  return resolved.resolved === "check"
    ? { sited: "check", check: resolved.check, engine: resolved.engine }
    : { sited: "unchecked-check", address: finding.check, mechanism: finding.mechanism };
};

export const nativeSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: AttributedCheckException;
}): readonly CheckSite[] => [
  findingSiteOf({ catalogue: request.catalogue, finding: request.exception }),
];

export const checkSiteText = ({ site }: { readonly site: CheckSite }): string =>
  site.sited === "check"
    ? `${qualifiedCheckAddressOf({ check: site.check })} ${site.engine.name}`
    : `${site.address} ${site.mechanism}`;
