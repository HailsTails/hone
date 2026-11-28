import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import {
  createCheckMembership,
  createCheckPages,
  createRuleContent,
  mapAddressToSymptom,
} from "./rule-content.ts";
import type { CheckAddress } from "./symptom-catalogue.ts";

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

describe("createCheckMembership", () => {
  it("distinguishes the same local address under different rule-set owners", () => {
    const tool: CheckAddress = {
      name: "loops",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
    };
    const team: CheckAddress = {
      name: "loops",
      symptom: { ruleSet: { name: ruleSetNameOf("acme") }, name: "loop-keyword" },
    };
    const membership = createCheckMembership({ catalogues: [{ checks: [tool] }] });

    const inTool = membership.hasCheck(tool);
    const inTeam = membership.hasCheck(team);

    expect([inTool, inTeam]).toEqual([true, false]);
  });
});

describe("createCheckPages", () => {
  it("gives each owner its page at the same local check address and leaves an unheld address unresolved", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const tool = {
      name: "loops",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      page: "hone/loops.md",
    };
    const team = {
      name: "loops",
      symptom: { ruleSet: acme, name: "loop-keyword" },
      page: "team/loops.md",
    };
    const pages = createCheckPages({
      catalogues: [
        { checks: [{ ...tool, engines: [{ name: "walker" }] }] },
        { checks: [{ ...team, engines: [{ name: "walker" }] }] },
      ],
    });

    const toolPage = pages.checkPage({
      ruleSet: TOOL_RULE_SET,
      check: "loop-keyword#loops",
      engine: "walker",
    });
    const teamPage = pages.checkPage({
      ruleSet: acme,
      check: "loop-keyword#loops",
      engine: "walker",
    });
    const unheld = pages.checkPage({
      ruleSet: acme,
      check: "loop-keyword#missing",
      engine: "walker",
    });

    expect([toolPage, teamPage, unheld]).toEqual([
      { resolved: "check", check: tool },
      { resolved: "check", check: team },
      { resolved: "none" },
    ]);
  });
});
