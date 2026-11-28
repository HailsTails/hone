import type { Check, CheckAddress, Symptom, SymptomAddress } from "./symptom-catalogue.ts";

export const mapSymptomToAddress = (request: { readonly symptom: Symptom }): SymptomAddress => ({
  ruleSet: request.symptom.ruleSet,
  name: request.symptom.name,
});

export const mapCheckToAddress = (request: { readonly check: Check }): CheckAddress => ({
  name: request.check.name,
  symptom: request.check.symptom,
});
