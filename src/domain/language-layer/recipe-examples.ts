import { type CheckAddressText, checkAddressTextOf } from "./check-address-text.ts";
import { qualifiedCheckAddressOf } from "./check-address.ts";
import { mapSymptomToReach } from "./recipe-reach.ts";
import { type CheckMembership, mapAddressToSymptom, type RuleContent } from "./rule-content.ts";
import {
  type CheckAddress,
  type Pointed,
  pointedNameOf,
  type Recipe,
} from "./symptom-catalogue.ts";

type AnsweringExample = {
  readonly recipe: string;
  readonly anchor: string;
  readonly check: CheckAddressText;
};

export type ExampleFault =
  | (AnsweringExample & { readonly kind: "check-unheld" })
  | (AnsweringExample & {
      readonly kind: "recipe-not-indicated";
      readonly symptom: string;
      readonly serves: readonly string[];
    });

export type ExampleAddress = { readonly recipe: Recipe; readonly anchor: string };

type CheckedExamples = {
  readonly recipe: Recipe;
  readonly serves: readonly Pointed[];
  readonly content: RuleContent<"mayIndicate">;
  readonly checks: CheckMembership;
};

const findCheckFaults = (
  request: CheckedExamples & { readonly anchor: string; readonly check: CheckAddress },
): readonly ExampleFault[] => {
  const { check, serves } = request;
  const answering: AnsweringExample = {
    recipe: request.recipe.name,
    anchor: request.anchor,
    check: checkAddressTextOf({ check }),
  };
  const symptom = mapAddressToSymptom({ content: request.content, symptom: check.symptom });
  if (!request.checks.hasCheck(check) || symptom.outcome === "failed") {
    return [{ kind: "check-unheld", ...answering }];
  }
  return mapSymptomToReach({ symptom: symptom.value, serves }) === "reached"
    ? []
    : [
        {
          kind: "recipe-not-indicated",
          ...answering,
          symptom: check.symptom.name,
          serves: serves.map((point) => pointedNameOf({ point })),
        },
      ];
};

export const findExampleFaults = (request: CheckedExamples): readonly ExampleFault[] =>
  (request.recipe.examples ?? []).flatMap(({ anchor, answers }) =>
    answers.flatMap(({ check }) => findCheckFaults({ ...request, anchor, check })),
  );

export const listExamplesOfForm = (request: {
  readonly recipes: readonly Recipe[];
  readonly check: CheckAddress;
  readonly form: string;
}): readonly ExampleAddress[] => {
  const address = qualifiedCheckAddressOf(request);
  return request.recipes.flatMap((recipe) =>
    (recipe.examples ?? [])
      .filter(({ answers }) =>
        answers.some(
          ({ check, form }) =>
            form === request.form && qualifiedCheckAddressOf({ check }) === address,
        ),
      )
      .map(({ anchor }) => ({ recipe, anchor })),
  );
};
