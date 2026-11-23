import { describe, expect, it } from "vitest";

import { checkAddressOf } from "../../../../../domain/language-layer/check-address.ts";
import type {
  Check,
  Engine,
  Symptom,
} from "../../../../../domain/language-layer/symptom-catalogue.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import {
  CHECKS_PLUGIN_NAMESPACE,
  checkOfRuleId,
  checkRuleIdOf,
  checkRuleNameOf,
  eslintRuleIdsOf,
  runsOnEslint,
} from "./check-rule-id.ts";

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const SETTINGS_REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-15"),
    clause: clauseIdOf("loops"),
  },
  engines: [WALKER, ESLINT],
  forms: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("test-body-logic"),
  },
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const SETTINGS_REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: SETTINGS_REBINDING,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("test-body-logic"),
  },
  engines: [WALKER],
  forms: ["a-let"],
};

const SETTINGS_CHECKS: readonly Check[] = [
  LOOP_KEYWORD_LOOPS,
  LOOP_KEYWORD_TEST_BODY,
  SETTINGS_REBINDING_TEST_BODY,
];

const TEST_SWITCHED_OFF: Symptom = {
  ruleSet: "hone",
  name: "test-switched-off",
  title: "Test switched off",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const POSITIONAL_PARAMETERS: Symptom = {
  ruleSet: "hone",
  name: "positional-parameters",
  title: "Positional parameters",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const PLUGIN_REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "a site",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const PLUGIN_CHECKS: readonly Check[] = [
  {
    name: "skipped-tests",
    symptom: TEST_SWITCHED_OFF,
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-27"),
      clause: clauseIdOf("skipped-tests"),
    },
    engines: [ESLINT],
    forms: [],
  },
  {
    name: "non-null-assertions",
    symptom: CLAIMED_TYPE,
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-2"),
      clause: clauseIdOf("non-null-assertions"),
    },
    engines: [ESLINT],
    forms: [],
  },
  {
    name: "parameter-count",
    symptom: POSITIONAL_PARAMETERS,
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-40"),
      clause: clauseIdOf("parameter-count"),
    },
    engines: [ESLINT],
    forms: [],
  },
  {
    name: "test-body",
    symptom: PLUGIN_REBINDING,
    clause: {
      ruleSet: TOOL_RULE_SET,
      discipline: disciplineIdOf("CD-27"),
      clause: clauseIdOf("test-body-logic"),
    },
    engines: [WALKER],
    forms: ["a-let"],
  },
];

describe("checkRuleIdOf", () => {
  it("names a check's rule hone/<symptom>#<check>", () => {
    expect(checkRuleIdOf({ check: LOOP_KEYWORD_LOOPS })).toBe("hone/loop-keyword#loops");
  });

  it("is the plugin namespace and the check's address, character for character", () => {
    expect(checkRuleIdOf({ check: LOOP_KEYWORD_LOOPS })).toBe(
      `${CHECKS_PLUGIN_NAMESPACE}/${checkAddressOf({ check: LOOP_KEYWORD_LOOPS })}`,
    );
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
    expect(runsOnEslint({ check: { engines: [{ name: "walker" }] } })).toBe("elsewhere");
  });
});

describe("CHECKS_PLUGIN_NAMESPACE", () => {
  it("is hone", () => {
    expect(CHECKS_PLUGIN_NAMESPACE).toBe("hone");
  });
});

describe("checkOfRuleId", () => {
  it("resolves a rule id to the ESLint check at its address", () => {
    expect(checkOfRuleId({ checks: SETTINGS_CHECKS, ruleId: "hone/loop-keyword#loops" })).toEqual({
      found: "check",
      check: LOOP_KEYWORD_LOOPS,
    });
  });

  it.each<{ readonly name: string; readonly ruleId: string }>([
    { name: "a check no ESLint engine runs", ruleId: "hone/rebinding#test-body" },
    { name: "an address the catalogue does not hold", ruleId: "hone/loop-keyword#nowhere" },
    { name: "another plugin's rule", ruleId: "hone-cd15/loop-keyword#loops" },
    { name: "a rule id that splits the address with a slash", ruleId: "hone/loop-keyword/loops" },
    { name: "a rule id with no check", ruleId: "hone/loop-keyword" },
  ])("resolves $name to none", ({ ruleId }) => {
    expect(checkOfRuleId({ checks: SETTINGS_CHECKS, ruleId })).toEqual({ found: "none" });
  });
});

describe("eslintRuleIdsOf", () => {
  it("names the rule of every check on ESLint, in catalogue order", () => {
    expect(eslintRuleIdsOf({ checks: PLUGIN_CHECKS })).toEqual([
      "hone/test-switched-off#skipped-tests",
      "hone/claimed-type#non-null-assertions",
      "hone/positional-parameters#parameter-count",
    ]);
  });
});
