import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { mapCheckToAddress, mapSymptomToAddress } from "./catalogue-address.ts";
import type { Check, Symptom } from "./symptom-catalogue.ts";

describe("mapSymptomToAddress", () => {
  it("keeps only the rule set and name of a symptom", () => {
    const symptom: Symptom = {
      ruleSet: TOOL_RULE_SET,
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "`for` or `while`.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };

    const address = mapSymptomToAddress({ symptom });

    expect(address).toEqual({ ruleSet: TOOL_RULE_SET, name: "loop-keyword" });
  });
});

describe("mapCheckToAddress", () => {
  it("keeps only the name of a check and the address of its symptom", () => {
    const check: Check = {
      name: "for-of",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
      page: "loop-keyword/for-of.md",
      forms: [],
      engines: [{ name: "walker" }],
    };

    const address = mapCheckToAddress({ check });

    expect(address).toEqual({
      name: "for-of",
      symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
    });
  });
});
