import { describe, expect, it } from "vitest";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { symptomsPageOf } from "./symptoms-page.ts";
import { clauseIdOf } from "../../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../src/domain/rule-set/discipline-id-of.ts";
import { TOOL_RULE_SET } from "../../../src/domain/rule-set/clause-address.ts";

const FILE: CatalogueFile = {
  version: 1,
  principles: [{ name: "one-place-decides", title: "One place decides" }],
  rules: [{ name: "declared-not-asserted", title: "Declared, not asserted", principle: "one-place-decides", standing: "accepted" }],
  cases: [
    { name: "gives-a-value-its-type", title: "Gives a value its type", standing: "accepted", owes: [{ rule: "declared-not-asserted" }] },
    { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ principle: "one-place-decides" }] },
  ],
  recipes: [
    {
      name: "fix-the-declaration",
      title: "Fix the declaration",
      serves: { rule: "declared-not-asserted" },
      standing: "accepted",
      reason: { text: "The declaration is wrong.", standing: "accepted" },
    },
  ],
  recordKinds: [
    { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
    { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "none-yet" },
  ],
  engines: [],
  symptoms: [
    {
      name: "claimed-type",
      title: "Claimed type",
      group: "Claimed types",
      seen: "An `as T` cast.",
      mayIndicate: [
        {
          case: "gives-a-value-its-type",
          situation: "in a test",
          quote: "casts hide a problem",
          points: [{ rule: "declared-not-asserted" }, { principle: "one-place-decides" }],
        },
        { case: "does-one-job", points: [{ rule: "declared-not-asserted" }] },
      ],
      breachUsuallySits: "in the declaration",
      seenBy: ["syntax", "types"],
      reports: "seen-to-breach",
      recipes: ["fix-the-declaration"],
      correctUses: [
        { situation: "correct use", kind: "authorised-location", at: "in the adapter" },
        { situation: "the unit's output", kind: "boundary-record" },
      ],
    },
    {
      name: "absence-as-state",
      title: "Absence as state",
      group: "Loose types",
      seen: "A null.",
      mayIndicate: [{ case: "does-one-job", points: [{ principle: "one-place-decides" }] }],
      breachUsuallySits: "in the type",
      seenBy: ["person"],
      recipes: [],
      correctUses: [],
    },
  ],
  clauses: [{ clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-1"), clause: clauseIdOf("any-cast") }, sight: { kind: "one-symptom", symptom: "claimed-type" } }],
  checks: [{ symptom: "claimed-type", name: "cast-to-any", clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-1"), clause: clauseIdOf("any-cast") } }],
  namedBans: [],
};

describe("symptomsPageOf", () => {
  it("renders each symptom under its group with its facts, what it needs today, its checks, recipes and prose, leaving out facts it lacks", () => {
    expect(
      symptomsPageOf({
        file: FILE,
        prose: new Map([["typescript/symptoms/claimed-type.md", "- **How it is seen:** syntax. See [the recipe](../recipes/fix-the-declaration.md)."]]),
      }),
    ).toEqual({
      path: "rules/typescript/symptoms.md",
      text: "# Symptoms in TypeScript\n\n## Claimed types\n\n### Claimed type\n\n- **Seen:** An `as T` cast.\n- **May indicate:** Gives a value its type: in a test → Declared, not asserted, One place decides (\"casts hide a problem\"); Does one job → Declared, not asserted.\n- **Breach usually sits:** in the declaration.\n- **Covered by a record:** correct use: an authorised location in the adapter; the unit's output: a boundary record.\n- **Seen by:** syntax, types.\n- **Reports:** seen → breach.\n- **Check today:** reuse.\n- **Checks:** [cast-to-any](symptoms/claimed-type/cast-to-any.md).\n- **Recipes:** [Fix the declaration](recipes.md#fix-the-declaration).\n\n- **How it is seen:** syntax. See [the recipe](recipes/fix-the-declaration.md).\n\n## Loose types\n\n### Absence as state\n\n- **Seen:** A null.\n- **May indicate:** Does one job → One place decides.\n- **Breach usually sits:** in the type.\n- **Seen by:** person.\n- **Check today:** only review.\n",
    });
  });
});
