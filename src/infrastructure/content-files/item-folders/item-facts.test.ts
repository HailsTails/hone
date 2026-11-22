import { describe, expect, it } from "vitest";
import { itemFactsOf } from "./item-facts.ts";
import type { ItemKind } from "./item-identity.ts";

const SYMPTOM_FACTS = {
  group: "The outside world reached directly",
  seen: "Any use of Date.",
  mayIndicate: [{ case: "does-one-job", quote: "Dating and numbering an order is not the same job as charging it", points: [{ rule: "doer-or-orchestrator" }] }],
  breachUsuallySits: "in the unit",
  seenBy: ["syntax"],
  reports: "seen",
  recipes: ["result-union"],
  correctUses: [{ situation: "correct use", kind: "boundary-record", at: "on the clock adapter" }],
};

describe("itemFactsOf", () => {
  it.each<{ readonly kind: ItemKind; readonly facts: unknown }>([
    { kind: "principle", facts: {} },
    { kind: "rule", facts: { principle: "tests-are-ours", standing: "accepted" } },
    { kind: "case", facts: { standing: "accepted", owes: [{ rule: "written-out-answers" }, { principle: "tests-are-ours" }] } },
    { kind: "recipe", facts: { serves: { rule: "written-out-answers" }, standing: "proposed", reason: { text: "stub with vi.fn", standing: "accepted" } } },
    { kind: "record-kind", facts: { phrase: "debt" } },
    { kind: "symptom", facts: SYMPTOM_FACTS },
    { kind: "check", facts: {} },
    { kind: "rule", facts: { principle: "outside-risk-is-carried-on-purpose", standing: "accepted", namedBans: ["lodash"] } },
  ])("accepts the facts of a $kind as they are written", ({ kind, facts }) => {
    expect(itemFactsOf({ kind, facts })).toEqual({ outcome: "ok", value: { kind, facts } });
  });

  it.each<{ readonly name: string; readonly kind: ItemKind; readonly facts: unknown }>([
    { name: "a name the file already gives", kind: "rule", facts: { name: "x", principle: "tests-are-ours", standing: "accepted" } },
    { name: "a title the heading already gives", kind: "principle", facts: { title: "Tests are ours" } },
    { name: "a symptom the folder already gives", kind: "check", facts: { symptom: "a" } },
    { name: "a missing fact", kind: "rule", facts: { principle: "tests-are-ours" } },
    { name: "engines, which the pieces give", kind: "check", facts: { engines: ["walker"] } },
    { name: "a format of today, which the version 1 names give", kind: "record-kind", facts: { phrase: "debt", todaysFormat: "file-carve-out" } },
    { name: "a standing that is neither accepted nor proposed", kind: "rule", facts: { principle: "p", standing: "maybe" } },
    { name: "a clause, which the version 1 names give", kind: "check", facts: { clause: "CD-17#clock-sources" } },
    { name: "a named ban list that is empty", kind: "rule", facts: { principle: "p", standing: "accepted", namedBans: [] } },
    { name: "facts that are no object", kind: "principle", facts: ["x"] },
  ])("refuses $name", ({ kind, facts }) => {
    expect(itemFactsOf({ kind, facts })).toEqual({ outcome: "failed", error: expect.any(String) });
  });
});
