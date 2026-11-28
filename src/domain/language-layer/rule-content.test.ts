import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import { createRuleContent, mapAddressToSymptom } from "./rule-content.ts";
import type { CheckContent } from "./symptom-catalogue.ts";

describe("mapAddressToSymptom", () => {
  it("gives the symptom a catalogue holds at the address", () => {
    const content = createRuleContent({
      catalogues: [
        {
          symptoms: [
            {
              ruleSet: TOOL_RULE_SET,
              name: "loop-keyword",
              title: "Loop keyword",
              seen: "`for` or `while`.",
              mayIndicate: [],
              breachUsuallySits: "in the unit",
              recipes: [],
              correctUses: [],
            },
          ],
        },
      ],
    });

    const symptom = mapAddressToSymptom({
      content,
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
    });

    expect(symptom).toEqual({
      outcome: "ok",
      value: {
        ruleSet: TOOL_RULE_SET,
        name: "loop-keyword",
        title: "Loop keyword",
        seen: "`for` or `while`.",
        mayIndicate: [],
        breachUsuallySits: "in the unit",
        recipes: [],
        correctUses: [],
      },
    });
  });

  it("refuses an address no catalogue holds, naming it unheld", () => {
    const content = createRuleContent({ catalogues: [{ symptoms: [] }] });

    const symptom = mapAddressToSymptom({
      content,
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
    });

    expect(symptom).toEqual({
      outcome: "failed",
      error: {
        kind: "symptom-unheld",
        symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      },
    });
  });

  it("keeps apart a team's symptom and Hone's of the same name", () => {
    const content = createRuleContent({
      catalogues: [
        {
          symptoms: [
            {
              ruleSet: TOOL_RULE_SET,
              name: "loop-keyword",
              title: "Hone's loop keyword",
              seen: "`for`.",
              mayIndicate: [],
              breachUsuallySits: "in the unit",
              recipes: [],
              correctUses: [],
            },
          ],
        },
        {
          symptoms: [
            {
              ruleSet: { name: ruleSetNameOf("acme") },
              name: "loop-keyword",
              title: "Acme's loop keyword",
              seen: "`while`.",
              mayIndicate: [],
              breachUsuallySits: "in the loop",
              recipes: [],
              correctUses: [],
            },
          ],
        },
      ],
    });

    const symptom = mapAddressToSymptom({
      content,
      symptom: { ruleSet: { name: ruleSetNameOf("acme") }, name: "loop-keyword" },
    });

    expect(symptom).toEqual({
      outcome: "ok",
      value: {
        ruleSet: { name: ruleSetNameOf("acme") },
        name: "loop-keyword",
        title: "Acme's loop keyword",
        seen: "`while`.",
        mayIndicate: [],
        breachUsuallySits: "in the loop",
        recipes: [],
        correctUses: [],
      },
    });
  });
});

describe("Rule Content check lookup", () => {
  it("answers the same local address for each owner and names a missing owner", () => {
    const toolCheck = {
      name: "loops",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      page: "loop-keyword/loops.md",
      forms: [],
      findingSpecifics: [],
    } satisfies CheckContent;
    const teamCheck = {
      ...toolCheck,
      symptom: { ruleSet: { name: ruleSetNameOf("acme") }, name: "loop-keyword" },
      page: "team/loop-keyword/loops.md",
    } satisfies CheckContent;
    const missing = {
      name: "loops",
      symptom: { ruleSet: { name: ruleSetNameOf("other") }, name: "loop-keyword" },
    };
    const content = createRuleContent({
      catalogueContents: [
        { symptoms: [], checks: [toolCheck] },
        { symptoms: [], checks: [teamCheck] },
      ],
    });

    const tool = content.check({ name: toolCheck.name, symptom: toolCheck.symptom });
    const team = content.check({ name: teamCheck.name, symptom: teamCheck.symptom });
    const absent = content.check(missing);

    expect(tool).toEqual({ outcome: "ok", value: toolCheck });
    expect(team).toEqual({ outcome: "ok", value: teamCheck });
    expect(absent).toEqual({ outcome: "failed", error: { kind: "check-unheld", check: missing } });
  });
});
