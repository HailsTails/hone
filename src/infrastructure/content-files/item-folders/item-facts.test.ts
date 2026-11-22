import { describe, expect, it } from "vitest";
import { itemFactsOf } from "./item-facts.ts";
import type { ItemKind } from "./item-identity.ts";

const SYMPTOM_FACTS = {
  seen: "Any use of Date.",
  mayIndicate: [{ case: "does-one-job", points: [{ rule: "doer-or-orchestrator" }] }],
  breachUsuallySits: "in the unit",
  recipes: ["result-union"],
  correctUses: [{ situation: "correct use", kind: "boundary-record", at: "on the clock adapter" }],
};

describe("itemFactsOf", () => {
  it.each<{ readonly kind: ItemKind; readonly facts: unknown }>([
    { kind: "principle", facts: {} },
    { kind: "rule", facts: { principle: "tests-are-ours", standing: "accepted" } },
    { kind: "case", facts: { standing: "accepted", owes: [{ rule: "written-out-answers" }, { principle: "tests-are-ours" }] } },
    { kind: "recipe", facts: { standing: "proposed", reason: { text: "stub with vi.fn", standing: "accepted" } } },
    { kind: "record-kind", facts: { phrase: "debt", todaysFormat: "none-yet" } },
    { kind: "symptom", facts: SYMPTOM_FACTS },
  ])("accepts the facts of a $kind as they are written", ({ kind, facts }) => {
    expect(itemFactsOf({ kind, facts })).toEqual({ outcome: "ok", value: { kind, facts } });
  });

  it("gives a check's clause as the clause address it names", () => {
    expect(itemFactsOf({ kind: "check", facts: { clause: "CD-17#clock-sources", engines: ["walker"] } })).toEqual({
      outcome: "ok",
      value: { kind: "check", facts: { clause: { ruleSet: "hone", discipline: "CD-17", clause: "clock-sources" }, engines: ["walker"] } },
    });
  });

  it.each<{ readonly name: string; readonly kind: ItemKind; readonly facts: unknown }>([
    { name: "a name the file already gives", kind: "rule", facts: { name: "x", principle: "tests-are-ours", standing: "accepted" } },
    { name: "a title the heading already gives", kind: "principle", facts: { title: "Tests are ours" } },
    { name: "a symptom the folder already gives", kind: "check", facts: { symptom: "a", clause: "CD-17#clock-sources", engines: ["walker"] } },
    { name: "a missing fact", kind: "rule", facts: { principle: "tests-are-ours" } },
    { name: "an engine list that is empty", kind: "check", facts: { clause: "CD-17#clock-sources", engines: [] } },
    { name: "a standing that is neither accepted nor proposed", kind: "rule", facts: { principle: "p", standing: "maybe" } },
    { name: "a clause that is no address", kind: "check", facts: { clause: "clock-sources", engines: ["walker"] } },
    { name: "facts that are no object", kind: "principle", facts: ["x"] },
  ])("refuses $name", ({ kind, facts }) => {
    expect(itemFactsOf({ kind, facts })).toEqual({ outcome: "failed", error: expect.any(String) });
  });
});
