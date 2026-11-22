import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { catalogueFileOf, type HeldBesideItems, type PlacedItem } from "./item-document.ts";

const CLOCK_SOURCES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-17"),
  clause: clauseIdOf("clock-sources"),
};

const PRINCIPLE: PlacedItem = {
  name: "tests-are-ours",
  within: undefined,
  title: "Tests are ours",
  item: { kind: "principle", facts: {} },
};

const RULE: PlacedItem = {
  name: "written-out-answers",
  within: undefined,
  title: "Written-out answers",
  item: { kind: "rule", facts: { principle: "tests-are-ours", standing: "accepted" } },
};

const BANNING_RULE: PlacedItem = {
  name: "outside-dependencies-justified",
  within: undefined,
  title: "Outside dependencies justified",
  item: {
    kind: "rule",
    facts: { principle: "tests-are-ours", standing: "accepted", namedBans: ["lodash", "fp-ts"] },
  },
};

const DEBT: PlacedItem = {
  name: "debt",
  within: undefined,
  title: "Debt",
  item: { kind: "record-kind", facts: { phrase: "debt" } },
};

const CHECK: PlacedItem = {
  name: "clock-sources",
  within: "date-used-directly",
  title: "Clock sources",
  item: { kind: "check", facts: {} },
};

const BESIDE: HeldBesideItems = {
  engines: [{ name: "walker" }],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: "date-used-directly" } },
  ],
  clauseOfCheck: new Map([["date-used-directly#clock-sources", CLOCK_SOURCES]]),
  formatsOfToday: { debt: "file-carve-out" },
};

const NOTHING_BESIDE: HeldBesideItems = {
  engines: [],
  clauses: [],
  clauseOfCheck: new Map(),
  formatsOfToday: {},
};

describe("catalogueFileOf", () => {
  it("gathers each kind into its list, naming each item from its place and titling it from its heading, beside what no item holds", () => {
    expect(catalogueFileOf({ items: [CHECK, DEBT, RULE, PRINCIPLE], beside: BESIDE })).toEqual({
      outcome: "ok",
      value: {
        version: 1,
        principles: [{ name: "tests-are-ours", title: "Tests are ours" }],
        rules: [
          {
            name: "written-out-answers",
            title: "Written-out answers",
            principle: "tests-are-ours",
            standing: "accepted",
          },
        ],
        cases: [],
        recipes: [],
        recordKinds: [
          { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" },
        ],
        engines: [{ name: "walker" }],
        symptoms: [],
        clauses: [
          { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: "date-used-directly" } },
        ],
        checks: [{ symptom: "date-used-directly", name: "clock-sources", clause: CLOCK_SOURCES }],
        namedBans: [],
      },
    });
  });

  it("gives the named bans the rules hold, and keeps them off the rules", () => {
    expect(catalogueFileOf({ items: [BANNING_RULE], beside: NOTHING_BESIDE })).toMatchObject({
      outcome: "ok",
      value: {
        rules: [
          {
            name: "outside-dependencies-justified",
            title: "Outside dependencies justified",
            principle: "tests-are-ours",
            standing: "accepted",
          },
        ],
        namedBans: [{ outsideDependency: "lodash" }, { outsideDependency: "fp-ts" }],
      },
    });
  });

  it("keeps the review lenses off the principles and rules, which the lens methods read from the items themselves", () => {
    const principle: PlacedItem = {
      ...PRINCIPLE,
      item: { kind: "principle", facts: { lenses: ["zod-boundary"] } },
    };
    const rule: PlacedItem = {
      ...RULE,
      item: {
        kind: "rule",
        facts: { principle: "tests-are-ours", standing: "accepted", lenses: ["test-discipline"] },
      },
    };
    expect(catalogueFileOf({ items: [principle, rule], beside: NOTHING_BESIDE })).toEqual({
      outcome: "ok",
      value: expect.objectContaining({
        principles: [{ name: "tests-are-ours", title: "Tests are ours" }],
        rules: [
          {
            name: "written-out-answers",
            title: "Written-out answers",
            principle: "tests-are-ours",
            standing: "accepted",
          },
        ],
      }),
    });
  });

  it("keeps two items of one kind in the order given", () => {
    const second: PlacedItem = {
      ...PRINCIPLE,
      name: "one-place-decides",
      title: "One place decides",
    };
    expect(catalogueFileOf({ items: [second, PRINCIPLE], beside: NOTHING_BESIDE })).toMatchObject({
      outcome: "ok",
      value: { principles: [{ name: "one-place-decides" }, { name: "tests-are-ours" }] },
    });
  });

  it("gives a record kind the version 1 names leave out no format of today", () => {
    expect(catalogueFileOf({ items: [DEBT], beside: NOTHING_BESIDE })).toMatchObject({
      outcome: "ok",
      value: {
        recordKinds: [{ name: "debt", title: "Debt", phrase: "debt", todaysFormat: "none-yet" }],
      },
    });
  });

  it("refuses a record kind whose name is no record kind", () => {
    expect(catalogueFileOf({ items: [{ ...DEBT, name: "lien" }], beside: NOTHING_BESIDE })).toEqual(
      { outcome: "failed", error: "lien is not the name of a record kind" },
    );
  });

  it("refuses a check that no clause of the version 1 names gives", () => {
    expect(catalogueFileOf({ items: [CHECK], beside: NOTHING_BESIDE })).toEqual({
      outcome: "failed",
      error: "date-used-directly#clock-sources is named by no clause in the version 1 names",
    });
  });

  it("refuses version 1 names that give a check no item holds", () => {
    expect(catalogueFileOf({ items: [], beside: BESIDE })).toEqual({
      outcome: "failed",
      error: "the version 1 names give date-used-directly#clock-sources, which no item holds",
    });
  });
});
