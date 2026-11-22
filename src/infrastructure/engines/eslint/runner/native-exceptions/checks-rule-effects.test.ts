import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import {
  allOffIn,
  type CheckedFile,
  enabledEverywhere,
  ignoreExceptionsOf,
  overrideExceptionsOf,
  type RuleTarget,
} from "./checks-rule-effects.ts";

const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-1"),
  clause: clauseIdOf("explicit-any"),
};

const FILE = repoPathOf("src/a.ts");

const NAMED: RuleTarget = { ruleId: "hone/a", clause: CLAUSE, check: "untyped-value#explicit-any" };

const UNNAMED: RuleTarget = { ruleId: "hone/a", clause: CLAUSE, check: undefined };

const enforcedIn: CheckedFile = {
  file: FILE,
  states: [{ ruleId: "hone/a", state: { state: "configured", severity: 2, options: [] } }],
};

const offIn: CheckedFile = {
  file: FILE,
  states: [{ ruleId: "hone/a", state: { state: "configured", severity: 0, options: [] } }],
};

const warnedIn: CheckedFile = {
  file: FILE,
  states: [{ ruleId: "hone/a", state: { state: "configured", severity: 1, options: [] } }],
};

const absentIn: CheckedFile = {
  file: FILE,
  states: [{ ruleId: "hone/a", state: { state: "rule-absent" } }],
};

describe("enabledEverywhere", () => {
  it("is in effect when no file was checked", () => {
    expect(enabledEverywhere({ ruleIds: ["hone/a"], checked: [] })).toBe("in-effect");
  });

  it("is in effect when every rule is configured in some checked file", () => {
    expect(enabledEverywhere({ ruleIds: ["hone/a"], checked: [absentIn, offIn] })).toBe(
      "in-effect",
    );
  });

  it("is not in effect when a rule is configured in no checked file", () => {
    expect(enabledEverywhere({ ruleIds: ["hone/a"], checked: [absentIn] })).toBe("not-in-effect");
  });
});

describe("allOffIn", () => {
  it("is in effect when every rule is off in the file", () => {
    expect(allOffIn({ checked: offIn, ruleIds: ["hone/a"] })).toBe("in-effect");
  });

  it("is not in effect when a rule is enforced in the file", () => {
    expect(allOffIn({ checked: enforcedIn, ruleIds: ["hone/a"] })).toBe("not-in-effect");
  });

  it("is in effect when no rule is asked about", () => {
    expect(allOffIn({ checked: enforcedIn, ruleIds: [] })).toBe("in-effect");
  });
});

describe("ignoreExceptionsOf", () => {
  it("gives an ignore exception for each target, naming its check when it has one", () => {
    expect(ignoreExceptionsOf({ targets: [NAMED, UNNAMED], file: FILE })).toEqual([
      { kind: "ignore", clause: CLAUSE, file: "src/a.ts", check: "untyped-value#explicit-any" },
      { kind: "ignore", clause: CLAUSE, file: "src/a.ts" },
    ]);
  });
});

describe("overrideExceptionsOf", () => {
  it("gives a config override for a target the file weakens and nothing holds", () => {
    expect(
      overrideExceptionsOf({ targets: [NAMED], checked: offIn, holding: () => "does-not-hold" }),
    ).toEqual([
      {
        kind: "config-override",
        clause: CLAUSE,
        file: "src/a.ts",
        check: "untyped-value#explicit-any",
      },
    ]);
  });

  it("gives a config override for a rule that is only a warning", () => {
    expect(
      overrideExceptionsOf({
        targets: [UNNAMED],
        checked: warnedIn,
        holding: () => "does-not-hold",
      }),
    ).toEqual([{ kind: "config-override", clause: CLAUSE, file: "src/a.ts" }]);
  });

  it("gives none for a target the file enforces", () => {
    expect(
      overrideExceptionsOf({
        targets: [NAMED],
        checked: enforcedIn,
        holding: () => "does-not-hold",
      }),
    ).toEqual([]);
  });

  it("gives none for a weakened target something holds", () => {
    expect(
      overrideExceptionsOf({ targets: [NAMED], checked: offIn, holding: () => "holds" }),
    ).toEqual([]);
  });
});
