import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import { findExampleFaults, listExamplesOfForm } from "./recipe-examples.ts";
import { createCheckMembership, createRuleContent } from "./rule-content.ts";
import type { Case, CheckContent, Principle, Recipe, Rule, Symptom } from "./symptom-catalogue.ts";

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const WRITTEN_OUT_ANSWERS: Rule = {
  name: "written-out-answers",
  title: "Written-out answers",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const KEEPS_STATE: Case = {
  name: "keeps-state",
  title: "Keeps state",
  standing: "accepted",
  owes: [],
};

const REBINDING: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "rebinding",
  title: "Rebinding",
  seen: "A let.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const TEST_BODY: CheckContent = {
  name: "test-body",
  symptom: { ruleSet: TOOL_RULE_SET, name: "rebinding" },
  page: "rebinding/test-body.md",
  forms: ["a-let"],
  findingSpecifics: [],
};

const STUB: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "stub-with-vi-fn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "It has no body.", standing: "accepted" },
  examples: [
    {
      anchor: "a-recorded-let",
      answers: [
        {
          check: { name: "test-body", symptom: { ruleSet: TOOL_RULE_SET, name: "rebinding" } },
          form: "a-let",
        },
      ],
    },
  ],
};

describe("findExampleFaults", () => {
  it("finds no fault where a rule the recipe serves is one the symptom indicates", () => {
    const found = findExampleFaults({
      recipe: STUB,
      serves: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
      content: createRuleContent({
        catalogues: [
          {
            symptoms: [
              {
                ...REBINDING,
                mayIndicate: [
                  { case: KEEPS_STATE, points: [{ kind: "rule", rule: WRITTEN_OUT_ANSWERS }] },
                ],
              },
            ],
          },
        ],
      }),
      checks: createCheckMembership({ catalogues: [{ checks: [TEST_BODY] }] }),
    });

    expect(found).toEqual([]);
  });

  it("faults an example whose recipe serves nothing the symptom indicates, naming each thing it serves", () => {
    const found = findExampleFaults({
      recipe: STUB,
      serves: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "principle", principle: NO_HIDDEN_EFFECTS },
      ],
      content: createRuleContent({
        catalogues: [
          {
            symptoms: [
              {
                ...REBINDING,
                mayIndicate: [
                  { case: KEEPS_STATE, points: [{ kind: "rule", rule: WRITTEN_OUT_ANSWERS }] },
                ],
              },
            ],
          },
        ],
      }),
      checks: createCheckMembership({ catalogues: [{ checks: [TEST_BODY] }] }),
    });

    expect(found).toEqual([
      {
        kind: "recipe-not-indicated",
        recipe: "stub-with-vi-fn",
        anchor: "a-recorded-let",
        check: "rebinding#test-body",
        symptom: "rebinding",
        serves: ["straight-through-tests", "no-hidden-effects"],
      },
    ]);
  });

  it("faults an example when only another rule set owns the check name", () => {
    const found = findExampleFaults({
      recipe: STUB,
      serves: [{ kind: "rule", rule: WRITTEN_OUT_ANSWERS }],

      content: createRuleContent({ catalogues: [{ symptoms: [REBINDING] }] }),
      checks: createCheckMembership({
        catalogues: [
          {
            checks: [
              {
                ...TEST_BODY,
                symptom: { ...TEST_BODY.symptom, ruleSet: { name: ruleSetNameOf("acme") } },
              },
            ],
          },
        ],
      }),
    });

    expect(found).toEqual([
      {
        kind: "check-unheld",
        recipe: "stub-with-vi-fn",
        anchor: "a-recorded-let",
        check: "rebinding#test-body",
      },
    ]);
  });

  it("finds no fault in a recipe with no examples", () => {
    const found = findExampleFaults({
      recipe: {
        ruleSet: TOOL_RULE_SET,
        name: "stub-with-vi-fn",
        title: "Stub with vi.fn",
        standing: "accepted",
        reason: { text: "It has no body.", standing: "accepted" },
      },
      serves: [{ kind: "rule", rule: WRITTEN_OUT_ANSWERS }],
      content: createRuleContent({ catalogues: [] }),
      checks: createCheckMembership({ catalogues: [] }),
    });

    expect(found).toEqual([]);
  });
});

describe("listExamplesOfForm", () => {
  it("lists each example that answers the check and the form", () => {
    const listed = listExamplesOfForm({ recipes: [STUB], check: TEST_BODY, form: "a-let" });

    expect(listed).toEqual([{ recipe: STUB, anchor: "a-recorded-let" }]);
  });

  it.each([
    { name: "another form", check: TEST_BODY, form: "a-ternary" },
    { name: "another check", check: { ...TEST_BODY, name: "let-statement" }, form: "a-let" },
    {
      name: "a team's check of the same name",
      check: {
        ...TEST_BODY,
        symptom: { ruleSet: { name: ruleSetNameOf("acme") }, name: "rebinding" },
      },
      form: "a-let",
    },
  ])("lists no example for $name", ({ check, form }) => {
    const listed = listExamplesOfForm({ recipes: [STUB], check, form });

    expect(listed).toEqual([]);
  });
});
