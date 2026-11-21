import type { Finding } from "../../infrastructure/command-line/governance.ts";
import { checkNamedAt, checksOf } from "../language-layer/check-address.ts";
import { type Check, type Engine, type Symptom, type SymptomCatalogue, symptomReadingOf } from "../language-layer/symptom-catalogue.ts";

type CheckAtEngine = { readonly check: Check; readonly engine: Engine };

export type FindingCheck =
  | ({ readonly resolved: "check" } & CheckAtEngine)
  | { readonly resolved: "symptom-only"; readonly symptom: Symptom }
  | { readonly resolved: "none" };

const UNRESOLVED: FindingCheck = { resolved: "none" };

const atMeasuringEngine = (request: { readonly check: Check; readonly finding: Pick<Finding, "mechanism"> }): readonly CheckAtEngine[] =>
  request.check.engines.filter((engine) => engine.mechanism === request.finding.mechanism).map((engine) => ({ check: request.check, engine }));

const ofSymptom = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding; readonly symptom: Symptom }): FindingCheck => {
  const candidates = checksOf({ catalogue: request.catalogue, clause: request.finding.clause })
    .filter((check) => check.symptom.name === request.symptom.name)
    .flatMap((check) => atMeasuringEngine({ check, finding: request.finding }));
  const [only, ...others] = candidates;
  return only !== undefined && others.length === 0 ? { resolved: "check", ...only } : { resolved: "symptom-only", symptom: request.symptom };
};

const ofReading = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): FindingCheck => {
  const reading = symptomReadingOf(request);
  return reading.reading === "named" ? ofSymptom({ ...request, symptom: reading.symptom }) : UNRESOLVED;
};

export const checkOfFinding = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): FindingCheck => {
  const named = checkNamedAt({ catalogue: request.catalogue, clause: request.finding.clause, address: request.finding.check });
  switch (named.named) {
    case "unnamed":
      return ofReading(request);
    case "check": {
      const [measured] = atMeasuringEngine({ check: named.check, finding: request.finding });
      return measured === undefined ? UNRESOLVED : { resolved: "check", ...measured };
    }
    case "not-of-the-clause":
      return UNRESOLVED;
  }
};
