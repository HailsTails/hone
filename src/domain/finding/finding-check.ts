import {
  findCheckEngine,
  findQualifiedCheck,
  type FoundCheck,
} from "../language-layer/check-address.ts";
import type { Check, Engine, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { CheckFinding } from "./governance.ts";

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
  const engine = findCheckEngine({ check: found.check, engine: mechanism });
  return engine === undefined ? UNRESOLVED : { resolved: "check", check: found.check, engine };
};

export const resolveObservedCheck = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly observation: Pick<CheckFinding, "check" | "mechanism" | "ruleSet">;
}): FindingCheck => {
  const { catalogue, observation } = request;
  return mapCheckToFindingCheck({
    found: findQualifiedCheck({
      catalogue,
      ruleSet: observation.ruleSet,
      address: observation.check,
    }),
    mechanism: observation.mechanism,
  });
};
