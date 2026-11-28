import { sameOwnedName } from "../rule-set/rule-set-identity.ts";
import { type CheckAddressText, checkAddressTextOf } from "./check-address-text.ts";
import { mapSymptomToReach, type Reach } from "./recipe-reach.ts";
import { mapAddressToSymptom, type RuleContent, type RuleContentChecks } from "./rule-content.ts";
import {
  type CheckAddress,
  type Pointed,
  pointedNameOf,
  type Recipe,
  type RecipeExample,
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
  readonly content: RuleContent<"mayIndicate"> & RuleContentChecks;
};

const compareCheckAddresses = (request: {
  readonly left: CheckAddress;
  readonly right: CheckAddress;
}): "same" | "different" =>
  request.left.name === request.right.name
    ? sameOwnedName({ left: request.left.symptom, right: request.right.symptom })
    : "different";

const findCheckFaults = (
  request: CheckedExamples & { readonly anchor: string; readonly check: CheckAddress },
): readonly ExampleFault[] => {
  const { check, serves } = request;
  const answering: AnsweringExample = {
    recipe: request.recipe.name,
    anchor: request.anchor,
    check: checkAddressTextOf({ check }),
  };
  const held = request.content.check(check);
  const symptom = mapAddressToSymptom({ content: request.content, symptom: check.symptom });
  if (held.outcome === "failed" || symptom.outcome === "failed") {
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

const mapExampleToReach = (request: {
  readonly example: RecipeExample;
  readonly check: CheckAddress;
  readonly form: string;
}): Reach =>
  request.example.answers.some(
    (answer) =>
      answer.form === request.form &&
      compareCheckAddresses({ left: answer.check, right: request.check }) === "same",
  )
    ? "reached"
    : "not-reached";

export const listExamplesOfForm = (request: {
  readonly recipes: readonly Recipe[];
  readonly check: CheckAddress;
  readonly form: string;
}): readonly ExampleAddress[] =>
  request.recipes.flatMap((recipe) =>
    (recipe.examples ?? [])
      .filter((example) => mapExampleToReach({ ...request, example }) === "reached")
      .map(({ anchor }) => ({ recipe, anchor })),
  );
