import { describe, expect, it } from "vitest";

import type { Check, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { mapCataloguesToEngineChecks, mapChecksToEngineChecks } from "./engine-checks.ts";

describe("mapChecksToEngineChecks", () => {
  it("gives each check with the title of its symptom", () => {
    const checks: readonly Check[] = [
      {
        name: "for-of",
        symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
        page: "loop-keyword/for-of.md",
        forms: [],
        engines: [{ name: "walker" }],
      },
    ];
    const content = { symptoms: new Map([["loop-keyword", { title: "Loop keyword" }]]) };

    const engineChecks = mapChecksToEngineChecks({ checks, content });

    expect(engineChecks).toEqual({
      outcome: "ok",
      value: [
        {
          name: "for-of",
          symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword", title: "Loop keyword" },
          engines: [{ name: "walker" }],
        },
      ],
    });
  });

  it("fails naming the symptom a check names and the content does not hold", () => {
    const checks: readonly Check[] = [
      {
        name: "for-of",
        symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
        page: "loop-keyword/for-of.md",
        forms: [],
        engines: [{ name: "walker" }],
      },
    ];
    const content = { symptoms: new Map([["authored-class-or-this", { title: "Class" }]]) };

    const engineChecks = mapChecksToEngineChecks({ checks, content });

    expect(engineChecks).toEqual({
      outcome: "failed",
      error: {
        kind: "symptom-unheld",
        symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      },
    });
  });
});

describe("mapCataloguesToEngineChecks", () => {
  it("gives the checks of every catalogue with the title of the symptom each names across them", () => {
    const first: Pick<SymptomCatalogue, "checks" | "symptoms"> = {
      symptoms: [
        {
          ruleSet: TOOL_RULE_SET,
          name: "loop-keyword",
          title: "Loop keyword",
          seen: "seen",
          mayIndicate: [],
          breachUsuallySits: "somewhere",
          recipes: [],
          correctUses: [],
        },
      ],
      checks: [
        {
          name: "for-of",
          symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
          page: "loop-keyword/for-of.md",
          forms: [],
          engines: [{ name: "walker" }],
        },
      ],
    };
    const second: Pick<SymptomCatalogue, "checks" | "symptoms"> = {
      symptoms: [
        {
          ruleSet: TOOL_RULE_SET,
          name: "class-keyword",
          title: "Class keyword",
          seen: "seen",
          mayIndicate: [],
          breachUsuallySits: "somewhere",
          recipes: [],
          correctUses: [],
        },
      ],
      checks: [
        {
          name: "class",
          symptom: { ruleSet: TOOL_RULE_SET, name: "class-keyword" },
          page: "class-keyword/class.md",
          forms: [],
          engines: [{ name: "walker" }],
        },
      ],
    };

    const engineChecks = mapCataloguesToEngineChecks({ catalogues: [first, second] });

    expect(engineChecks).toEqual({
      outcome: "ok",
      value: [
        {
          name: "for-of",
          symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword", title: "Loop keyword" },
          engines: [{ name: "walker" }],
        },
        {
          name: "class",
          symptom: { ruleSet: TOOL_RULE_SET, name: "class-keyword", title: "Class keyword" },
          engines: [{ name: "walker" }],
        },
      ],
    });
  });
});
