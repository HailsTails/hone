import { checkAddressOf, checkNamedAt, checksOf } from "../language-layer/check-address.ts";
import type { NamedCheck } from "../language-layer/check-address.ts";
import type { Check, Engine, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../rule-set/clause-address.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { NativeException } from "../runner/runner-result-types.ts";
import { type FindingCheck, checkOfFinding } from "./finding-check.ts";
import type { Finding } from "./governance.ts";

export type CheckSite =
  | { readonly sited: "check"; readonly check: Check; readonly engine: Engine }
  | { readonly sited: "unchecked"; readonly clause: ClauseAddress; readonly mechanism: EngineId };

type EngineRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly clause: ClauseAddress;
  readonly mechanism: EngineId;
};

const uncheckedSite = (request: EngineRequest): CheckSite => ({
  sited: "unchecked",
  clause: request.clause,
  mechanism: request.mechanism,
});

const sitesOfCheck = (request: {
  readonly check: Check;
  readonly mechanism: EngineId;
}): readonly CheckSite[] =>
  request.check.engines
    .filter((engine) => engine.name === request.mechanism)
    .map((engine) => ({ sited: "check", check: request.check, engine }));

const sitesAtEngine = (request: EngineRequest): readonly CheckSite[] =>
  checksOf(request).flatMap((check) => sitesOfCheck({ check, mechanism: request.mechanism }));

const sitesOfNamed = (request: {
  readonly named: NamedCheck;
  readonly engineRequest: EngineRequest;
}): readonly CheckSite[] => {
  switch (request.named.named) {
    case "unnamed":
      return sitesAtEngine(request.engineRequest);
    case "check":
      return sitesOfCheck({
        check: request.named.check,
        mechanism: request.engineRequest.mechanism,
      });
    case "not-of-the-clause":
      return [];
  }
};

const siteOfResolved = (request: {
  readonly resolved: FindingCheck;
  readonly engineRequest: EngineRequest;
}): CheckSite =>
  request.resolved.resolved === "check"
    ? { sited: "check", check: request.resolved.check, engine: request.resolved.engine }
    : uncheckedSite(request.engineRequest);

export const findingSiteOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Finding;
}): CheckSite =>
  siteOfResolved({
    resolved: checkOfFinding(request),
    engineRequest: {
      catalogue: request.catalogue,
      clause: request.finding.clause,
      mechanism: request.finding.mechanism,
    },
  });

export const nativeSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: NativeException & { readonly mechanism: EngineId };
}): readonly CheckSite[] => {
  const engineRequest: EngineRequest = {
    catalogue: request.catalogue,
    clause: request.exception.clause,
    mechanism: request.exception.mechanism,
  };
  const named = checkNamedAt({
    catalogue: request.catalogue,
    clause: request.exception.clause,
    address: request.exception.check,
  });
  const sites = sitesOfNamed({ named, engineRequest });
  return sites.length === 0 ? [uncheckedSite(engineRequest)] : sites;
};

export const checkSiteText = (request: { readonly site: CheckSite }): string => {
  switch (request.site.sited) {
    case "check":
      return `${checkAddressOf({ check: request.site.check })} ${request.site.engine.name}`;
    case "unchecked":
      return `${clauseAddressText({ address: request.site.clause })} ${request.site.mechanism}`;
  }
};
