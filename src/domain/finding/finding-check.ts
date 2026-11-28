import { checkAt, type FoundCheck } from "../language-layer/check-address.ts";
import type { Check, Engine, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { AttributedCheckException, CheckFinding } from "./governance.ts";

export type FindingCheck =
  | { readonly resolved: "check"; readonly check: Check; readonly engine: Engine }
  | { readonly resolved: "none" };

const UNRESOLVED: FindingCheck = { resolved: "none" };

const mapCheckToFindingCheck = (request: {
  readonly found: FoundCheck;
  readonly mechanism: EngineId;
}): FindingCheck => {
  const { found, mechanism } = request;
  if (found.found === "none") return UNRESOLVED;
  const engine = found.check.engines.find(({ name }) => name === mechanism);
  return engine === undefined ? UNRESOLVED : { resolved: "check", check: found.check, engine };
};

export const checkOfFinding = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Pick<CheckFinding, "check" | "mechanism" | "ruleSet">;
}): FindingCheck => {
  const { catalogue, finding } = request;
  return mapCheckToFindingCheck({
    found: checkAt({ catalogue, address: { ruleSet: finding.ruleSet, name: finding.check } }),
    mechanism: finding.mechanism,
  });
};

export const checkOfNativeException = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: Pick<AttributedCheckException, "check" | "mechanism">;
}): FindingCheck =>
  mapCheckToFindingCheck({
    found: checkAt({ catalogue: request.catalogue, address: request.exception.check }),
    mechanism: request.exception.mechanism,
  });
