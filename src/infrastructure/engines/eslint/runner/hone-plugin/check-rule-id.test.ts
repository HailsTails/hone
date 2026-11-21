import { describe, expect, it } from "vitest";
import { checkAddressOf } from "../../../../../domain/language-layer/check-address.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { CHECKS_PLUGIN_CATALOGUE } from "../../../../../../tests/checks-plugin-catalogue.ts";
import { LOOP_KEYWORD_LOOPS, SETTINGS_CATALOGUE } from "../../../../../../tests/settings-catalogue.ts";
import { CHECKS_PLUGIN_NAMESPACE, checkOfRuleId, checkRuleIdOf, checkRuleNameOf, eslintRuleIdsOf, runsOnEslint } from "./check-rule-id.ts";

describe("checkRuleIdOf", () => {
  it("names a check's rule hone/<symptom>#<check>", () => {
    expect(checkRuleIdOf({ check: LOOP_KEYWORD_LOOPS })).toBe("hone/loop-keyword#loops");
  });

  it("is the plugin namespace and the check's address, character for character", () => {
    expect(checkRuleIdOf({ check: LOOP_KEYWORD_LOOPS })).toBe(`${CHECKS_PLUGIN_NAMESPACE}/${checkAddressOf({ check: LOOP_KEYWORD_LOOPS })}`);
  });
});

describe("checkRuleNameOf", () => {
  it("names a check's rule inside the plugin by the check's address", () => {
    expect(checkRuleNameOf({ check: LOOP_KEYWORD_LOOPS })).toBe("loop-keyword#loops");
  });
});

describe("runsOnEslint", () => {
  it("says a check one of whose engines is ESLint runs on ESLint", () => {
    expect(runsOnEslint({ check: LOOP_KEYWORD_LOOPS })).toBe("eslint");
  });

  it("says a check only the walker runs runs elsewhere", () => {
    expect(runsOnEslint({ check: { engines: [{ mechanism: mechanismIdSchema.parse("audit") }] } })).toBe("elsewhere");
  });
});

describe("CHECKS_PLUGIN_NAMESPACE", () => {
  it("is hone", () => {
    expect(CHECKS_PLUGIN_NAMESPACE).toBe("hone");
  });
});

describe("checkOfRuleId", () => {
  it("resolves a rule id to the ESLint check at its address", () => {
    expect(checkOfRuleId({ checks: SETTINGS_CATALOGUE.checks, ruleId: "hone/loop-keyword#loops" })).toEqual({ found: "check", check: LOOP_KEYWORD_LOOPS });
  });

  it.each<{ readonly name: string; readonly ruleId: string }>([
    { name: "a check no ESLint engine runs", ruleId: "hone/rebinding#test-body" },
    { name: "an address the catalogue does not hold", ruleId: "hone/loop-keyword#nowhere" },
    { name: "another plugin's rule", ruleId: "hone-cd15/loop-keyword#loops" },
    { name: "a rule id that splits the address with a slash", ruleId: "hone/loop-keyword/loops" },
    { name: "a rule id with no check", ruleId: "hone/loop-keyword" },
  ])("resolves $name to none", ({ ruleId }) => {
    expect(checkOfRuleId({ checks: SETTINGS_CATALOGUE.checks, ruleId })).toEqual({ found: "none" });
  });
});

describe("eslintRuleIdsOf", () => {
  it("names the rule of every check on ESLint, in catalogue order", () => {
    expect(eslintRuleIdsOf({ checks: CHECKS_PLUGIN_CATALOGUE.checks })).toEqual([
      "hone/test-switched-off#skipped-tests",
      "hone/claimed-type#non-null-assertions",
      "hone/positional-parameters#parameter-count",
    ]);
  });
});