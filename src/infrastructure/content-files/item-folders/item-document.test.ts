import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import { catalogueFileOf, type HeldBesideItems, type PlacedItem } from "./item-document.ts";

const PRINCIPLE: PlacedItem = { name: "tests-are-ours", within: undefined, title: "Tests are ours", item: { kind: "principle", facts: {} } };

const RULE: PlacedItem = {
  name: "written-out-answers",
  within: undefined,
  title: "Written-out answers",
  item: { kind: "rule", facts: { principle: "tests-are-ours", standing: "accepted" } },
};

const DEBT: PlacedItem = { name: "debt", within: undefined, title: "Debt", item: { kind: "record-kind", facts: { phrase: "debt", todaysFormat: "none-yet" } } };

const CHECK: PlacedItem = {
  name: "clock-sources",
  within: "date-used-directly",
  title: "Clock sources",
  item: { kind: "check", facts: { clause: clauseAddressSchema.parse("CD-17#clock-sources"), engines: ["walker"] } },
};

const BESIDE: HeldBesideItems = {
  engines: [{ name: "walker", mechanism: mechanismIdSchema.parse("audit") }],
  clauses: [{ clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "one-symptom", symptom: "date-used-directly" } }],
  namedBans: [{ outsideDependency: "lodash" }],
};

const NOTHING_BESIDE: HeldBesideItems = { engines: [], clauses: [], namedBans: [] };

describe("catalogueFileOf", () => {
  it("gathers each kind into its list, naming each item from its place and titling it from its heading, beside what no item holds", () => {
    expect(catalogueFileOf({ items: [CHECK, DEBT, RULE, PRINCIPLE], beside: BESIDE })).toEqual({
      outcome: "ok",
      value: {
        version: 1,
        principles: [{ name: "tests-are-ours", title: "Tests are ours" }],
        rules: [{ name: "written-out-answers", title: "Written-out answers", principle: "tests-are-ours", standing: "accepted" }],
        cases: [],
        recipes: [],
        recordKinds: [{ name: "debt", title: "Debt", phrase: "debt", todaysFormat: "none-yet" }],
        engines: [{ name: "walker", mechanism: "audit" }],
        symptoms: [],
        clauses: [{ clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "one-symptom", symptom: "date-used-directly" } }],
        checks: [{ symptom: "date-used-directly", name: "clock-sources", clause: clauseAddressSchema.parse("CD-17#clock-sources"), engines: ["walker"] }],
        namedBans: [{ outsideDependency: "lodash" }],
      },
    });
  });

  it("keeps two items of one kind in the order given", () => {
    const second: PlacedItem = { ...PRINCIPLE, name: "one-place-decides", title: "One place decides" };
    expect(catalogueFileOf({ items: [second, PRINCIPLE], beside: NOTHING_BESIDE })).toMatchObject({
      outcome: "ok",
      value: { principles: [{ name: "one-place-decides" }, { name: "tests-are-ours" }] },
    });
  });

  it("refuses a record kind whose name is no record kind", () => {
    expect(catalogueFileOf({ items: [{ ...DEBT, name: "lien" }], beside: NOTHING_BESIDE })).toEqual({ outcome: "failed", error: "lien is not the name of a record kind" });
  });
});
