import { describe, expect, it } from "vitest";

import { findRecipeFaults, mapSymptomToReach, type Reach } from "./recipe-reach.ts";
import type { Case, Pointed, Principle, Rule } from "./symptom-catalogue.ts";

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const WRITTEN_OUT_ANSWERS: Pointed = {
  kind: "rule",
  rule: {
    name: "written-out-answers",
    title: "Written-out answers",
    principle: TESTS_ARE_OURS,
    standing: "accepted",
  },
};

const STRAIGHT_THROUGH: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Pointed = { kind: "rule", rule: STRAIGHT_THROUGH };

const KEEPS_STATE: Case = {
  name: "keeps-state",
  title: "Keeps state",
  standing: "accepted",
  owes: [],
};

type ReachRow = {
  readonly name: string;
  readonly point: Pointed;
  readonly serves: readonly Pointed[];
  readonly expected: Reach;
};

describe("mapSymptomToReach", () => {
  it.each<ReachRow>([
    {
      name: "the rule the symptom indicates",
      point: WRITTEN_OUT_ANSWERS,
      serves: [WRITTEN_OUT_ANSWERS],
      expected: "reached",
    },
    {
      name: "a rule of the principle the symptom indicates",
      point: { kind: "principle", principle: TESTS_ARE_OURS },
      serves: [WRITTEN_OUT_ANSWERS],
      expected: "reached",
    },
    {
      name: "the principle the symptom indicates",
      point: { kind: "principle", principle: TESTS_ARE_OURS },
      serves: [{ kind: "principle", principle: TESTS_ARE_OURS }],
      expected: "reached",
    },
    {
      name: "second the rule the symptom indicates",
      point: WRITTEN_OUT_ANSWERS,
      serves: [STRAIGHT_THROUGH_TESTS, WRITTEN_OUT_ANSWERS],
      expected: "reached",
    },
    {
      name: "another rule of the same principle",
      point: STRAIGHT_THROUGH_TESTS,
      serves: [WRITTEN_OUT_ANSWERS],
      expected: "not-reached",
    },
    {
      name: "the principle of a rule the symptom indicates",
      point: WRITTEN_OUT_ANSWERS,
      serves: [{ kind: "principle", principle: TESTS_ARE_OURS }],
      expected: "not-reached",
    },
    {
      name: "another principle",
      point: { kind: "principle", principle: NO_HIDDEN_EFFECTS },
      serves: [WRITTEN_OUT_ANSWERS],
      expected: "not-reached",
    },
  ])("gives $expected for a recipe serving $name", ({ point, serves, expected }) => {
    const reach = mapSymptomToReach({
      symptom: { mayIndicate: [{ case: KEEPS_STATE, points: [point] }] },
      serves,
    });

    expect(reach).toBe(expected);
  });
});

describe("findRecipeFaults", () => {
  it("faults each recipe that serves nothing the symptom indicates", () => {
    const faults = findRecipeFaults({
      symptom: {
        name: "rebinding",
        mayIndicate: [{ case: KEEPS_STATE, points: [WRITTEN_OUT_ANSWERS] }],
      },
      recipes: [
        { name: "stub-with-vi-fn", serves: [STRAIGHT_THROUGH_TESTS, WRITTEN_OUT_ANSWERS] },
        { name: "assert-to-narrow", serves: [STRAIGHT_THROUGH_TESTS] },
      ],
    });

    expect(faults).toEqual([
      {
        kind: "recipe-not-indicated",
        symptom: "rebinding",
        recipe: "assert-to-narrow",
        serves: ["straight-through-tests"],
      },
    ]);
  });
});
