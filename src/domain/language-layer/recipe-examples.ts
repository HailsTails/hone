import { sameOwnedName } from "../rule-set/rule-set-identity.ts";
import { type CheckAddressText, checkAddressTextOf } from "./check-address-text.ts";
import { mapSymptomToReach, type Reach } from "./recipe-reach.ts";
import {
  type CheckAddress,
  type CheckContent,
  type Pointed,
  pointedNameOf,
  type Recipe,
  type RecipeExample,
  type Symptom,
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
  readonly symptoms: readonly Pick<Symptom, "ruleSet" | "name" | "mayIndicate">[];
  readonly checks: readonly CheckContent[];
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
  const held = request.checks.find(
    (candidate) => compareCheckAddresses({ left: candidate, right: check }) === "same",
  );
  const symptom = request.symptoms.find(
    (candidate) => sameOwnedName({ left: candidate, right: check.symptom }) === "same",
  );
  if (held === undefined || symptom === undefined) {
    return [{ kind: "check-unheld", ...answering }];
  }
  return mapSymptomToReach({ symptom, serves }) === "reached"
    ? []
    : [
        {
          kind: "recipe-not-indicated",
          ...answering,
          symptom: symptom.name,
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
