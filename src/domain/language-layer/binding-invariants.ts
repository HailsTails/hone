import {
  type CheckContent,
  mapCheckToPartyNaming,
  mapSymptomToAuthorisation,
  type Symptom,
} from "./symptom-catalogue.ts";

export type BindingFault =
  | { readonly kind: "divergent-bindings"; readonly symptom: string }
  | { readonly kind: "binding-not-reported"; readonly symptom: string; readonly check: string };

export const listDivergentBindings = (request: {
  readonly symptom: Symptom;
}): readonly BindingFault[] => {
  const bindings = new Set(
    request.symptom.correctUses.flatMap((use) => ("binding" in use ? [use.binding] : [])),
  );
  return bindings.size > 1 ? [{ kind: "divergent-bindings", symptom: request.symptom.name }] : [];
};

export const listUnreportedBindings = (request: {
  readonly symptoms: readonly Symptom[];
  readonly checks: readonly CheckContent[];
}): readonly BindingFault[] =>
  request.symptoms
    .filter((symptom) => mapSymptomToAuthorisation({ symptom }) === "check-file-and-outside-party")
    .flatMap((symptom) =>
      request.checks
        .filter(
          (check) =>
            check.symptom.name === symptom.name &&
            mapCheckToPartyNaming({ check }) === "names-no-party",
        )
        .map((check): BindingFault => ({
          kind: "binding-not-reported",
          symptom: symptom.name,
          check: check.name,
        })),
    );
