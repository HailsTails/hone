import { describe, expect, it } from "vitest";

import { isRuleSetName } from "./identifiers.ts";
import { ruleSetNameOf } from "./rule-set-name-of.ts";

describe("ruleSetNameOf", () => {
  it.each(["team", "team-a", "a1"] as const)("returns %s unchanged", (text) => {
    expect(ruleSetNameOf(text)).toBe(text);
  });

  it("returns text the rule-set-name guard accepts", () => {
    expect(isRuleSetName(ruleSetNameOf("acme"))).toBe(true);
  });
});
