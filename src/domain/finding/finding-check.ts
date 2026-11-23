import { checkAt } from "../language-layer/check-address.ts";
import type { Check, Engine, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import type { CheckFinding } from "./governance.ts";

export type FindingCheck =
  | { readonly resolved: "check"; readonly check: Check; readonly engine: Engine }
  | { readonly resolved: "none" };

const UNRESOLVED: FindingCheck = { resolved: "none" };

export const checkOfFinding = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Pick<CheckFinding, "check" | "mechanism">;
}): FindingCheck => {
  const { catalogue, finding } = request;
  const found = checkAt({ catalogue, address: finding.check });
  if (found.found === "none") return UNRESOLVED;
  const engine = found.check.engines.find(({ name }) => name === finding.mechanism);
  return engine === undefined ? UNRESOLVED : { resolved: "check", check: found.check, engine };
};
