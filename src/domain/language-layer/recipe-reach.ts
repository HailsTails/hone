import { type Pointed, pointedNameOf, type Symptom } from "./symptom-catalogue.ts";

export type Reach = "reached" | "not-reached";

export type ServingRecipe = { readonly name: string; readonly serves: readonly Pointed[] };

export type RecipeFault = {
  readonly kind: "recipe-not-indicated";
  readonly symptom: string;
  readonly recipe: string;
  readonly serves: readonly string[];
};

type IndicatingSymptom = Pick<Symptom, "name" | "mayIndicate">;

const mapPointToReach = (request: { readonly point: Pointed; readonly serves: Pointed }): Reach => {
  const { point, serves } = request;
  if (point.kind === "rule") {
    return serves.kind === "rule" && serves.rule.name === point.rule.name
      ? "reached"
      : "not-reached";
  }
  const principle = serves.kind === "rule" ? serves.rule.principle : serves.principle;
  return principle.name === point.principle.name ? "reached" : "not-reached";
};

export const mapSymptomToReach = (request: {
  readonly symptom: Pick<Symptom, "mayIndicate">;
  readonly serves: readonly Pointed[];
}): Reach => {
  const points = request.symptom.mayIndicate.flatMap((indication) => indication.points);
  return request.serves.some((serves) =>
    points.some((point) => mapPointToReach({ point, serves }) === "reached"),
  )
    ? "reached"
    : "not-reached";
};

export const findRecipeFaults = (request: {
  readonly symptom: IndicatingSymptom;
  readonly recipes: readonly ServingRecipe[];
}): readonly RecipeFault[] =>
  request.recipes
    .filter(({ serves }) => mapSymptomToReach({ ...request, serves }) === "not-reached")
    .map(({ name, serves }) => ({
      kind: "recipe-not-indicated",
      symptom: request.symptom.name,
      recipe: name,
      serves: serves.map((point) => pointedNameOf({ point })),
    }));
