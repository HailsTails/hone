import { describe, expect, it } from "vitest";

import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import {
  checkAddressOf,
  checkAt,
  checkNamedAt,
  checksOf,
  qualifiedCheckAddressOf,
} from "./check-address.ts";
import type {
  Check,
  Engine,
  Principle,
  Recipe,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "./symptom-catalogue.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [
    {
      case: {
        name: "makes-a-new-value-from-what-it-has",
        title: "Makes a new value from what it has",
        standing: "accepted",
        owes: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
      },
      points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
    },
  ],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = { ...LOOP_KEYWORD, name: "rebinding", title: "Rebinding" };

const LOOPS_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layer-boundaries"),
};

const RESULT_FAILURES_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-9"),
  clause: clauseIdOf("result-failures"),
};

const FAILURES_AS_VALUES: Recipe = {
  ruleSet: "hone",
  name: "failures-as-values",
  title: "Failures as values",
  standing: "accepted",
  reason: { text: "A caller handles each named failure.", standing: "accepted" },
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  clause: LOOPS_CLAUSE,
  engines: [WALKER],
  forms: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
};

const CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [FAILURES_AS_VALUES],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "a-for-loop", symptom: LOOP_KEYWORD },
          { section: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
    {
      clause: RESULT_FAILURES_CLAUSE,
      sight: { kind: "method", recipe: FAILURES_AS_VALUES, outcomeSeenBy: [REBINDING] },
    },
    {
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-32"),
        clause: clauseIdOf("pii-redaction"),
      },
      sight: { kind: "outside-the-cases" },
    },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

describe("checkAddressOf", () => {
  type AddressRow = { readonly name: string; readonly check: Check; readonly address: string };

  it.each<AddressRow>([
    {
      name: "a check that is its clause's only check",
      check: LOOP_KEYWORD_LOOPS,
      address: "loop-keyword#loops",
    },
    {
      name: "one symptom's check on a clause that sees several",
      check: REBINDING_TEST_BODY,
      address: "rebinding#test-body",
    },
  ])("addresses $name by its symptom and its name", ({ check, address }) => {
    expect(checkAddressOf({ check })).toBe(address);
  });
});

describe("checkAt", () => {
  type FoundRow = { readonly address: string; readonly check: Check };

  it.each<FoundRow>([
    { address: "loop-keyword#loops", check: LOOP_KEYWORD_LOOPS },
    { address: "loop-keyword#test-body", check: LOOP_KEYWORD_TEST_BODY },
    { address: "rebinding#test-body", check: REBINDING_TEST_BODY },
  ])("finds the check at $address", ({ address, check }) => {
    expect(checkAt({ catalogue: CATALOGUE, address })).toEqual({ found: "check", check });
  });

  it.each<{ readonly name: string; readonly address: string }>([
    { name: "a check name under a symptom that has no such check", address: "rebinding#loops" },
    { name: "a symptom the catalogue does not hold", address: "untyped-value#loops" },
    { name: "a clause id in place of a check address", address: "CD-15#loops" },
    { name: "an address without a check name", address: "loop-keyword" },
  ])("finds nothing at $name", ({ address }) => {
    expect(checkAt({ catalogue: CATALOGUE, address })).toEqual({ found: "none" });
  });
});

describe("checksOf", () => {
  type ClauseRow = {
    readonly name: string;
    readonly clause: ClauseAddress;
    readonly checks: readonly Check[];
  };

  it.each<ClauseRow>([
    { name: "a clause that sees one symptom", clause: LOOPS_CLAUSE, checks: [LOOP_KEYWORD_LOOPS] },
    {
      name: "a clause that sees a symptom by each form",
      clause: TEST_BODY_CLAUSE,
      checks: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
    },
    {
      name: "a clause named with its rule set",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-15"),
        clause: clauseIdOf("loops"),
      },
      checks: [LOOP_KEYWORD_LOOPS],
    },
    {
      name: "a judgement clause, which sees a symptom but has no check",
      clause: LAYERING_CLAUSE,
      checks: [],
    },
    { name: "a clause that demands a method", clause: RESULT_FAILURES_CLAUSE, checks: [] },
    {
      name: "a team rule set's clause of the same id as one of Hone's",
      clause: {
        ruleSet: { name: ruleSetNameOf("team") },
        discipline: disciplineIdOf("CD-15"),
        clause: clauseIdOf("loops"),
      },
      checks: [],
    },
    {
      name: "a clause outside the cases",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-32"),
        clause: clauseIdOf("pii-redaction"),
      },
      checks: [],
    },
    {
      name: "a clause the catalogue does not hold",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-99"),
        clause: clauseIdOf("unheld"),
      },
      checks: [],
    },
  ])("gives the checks of $name", ({ clause, checks }) => {
    expect(checksOf({ catalogue: CATALOGUE, clause })).toEqual(checks);
  });
});

describe("checkNamedAt", () => {
  it("is unnamed when no check is named", () => {
    expect(
      checkNamedAt({ catalogue: CATALOGUE, clause: TEST_BODY_CLAUSE, address: undefined }),
    ).toEqual({ named: "unnamed" });
  });

  it.each<{ readonly address: string; readonly check: Check }>([
    { address: "loop-keyword#test-body", check: LOOP_KEYWORD_TEST_BODY },
    { address: "rebinding#test-body", check: REBINDING_TEST_BODY },
  ])("is the check $address when the clause has it", ({ address, check }) => {
    expect(checkNamedAt({ catalogue: CATALOGUE, clause: TEST_BODY_CLAUSE, address })).toEqual({
      named: "check",
      check,
    });
  });

  it.each<{ readonly name: string; readonly clause: ClauseAddress; readonly address: string }>([
    { name: "a check of another clause", clause: LOOPS_CLAUSE, address: "rebinding#test-body" },
    { name: "a check no clause has", clause: TEST_BODY_CLAUSE, address: "rebinding#loops" },
    {
      name: "a clause address in place of a check address",
      clause: TEST_BODY_CLAUSE,
      address: "CD-27#test-body-logic",
    },
    { name: "a name with no hash", clause: TEST_BODY_CLAUSE, address: "nohash" },
  ])("is not-of-the-clause for $name", ({ clause, address }) => {
    expect(checkNamedAt({ catalogue: CATALOGUE, clause, address })).toEqual({
      named: "not-of-the-clause",
      address,
    });
  });
});

describe("qualifiedCheckAddressOf", () => {
  it("gives a check of Hone's own rule set by its symptom and name alone", () => {
    expect(qualifiedCheckAddressOf({ check: LOOP_KEYWORD_LOOPS })).toBe("loop-keyword#loops");
  });

  it("puts the team's rule set before a check of a team's symptom", () => {
    expect(
      qualifiedCheckAddressOf({
        check: {
          ...LOOP_KEYWORD_LOOPS,
          symptom: { ...LOOP_KEYWORD, ruleSet: { name: ruleSetNameOf("acme") } },
        },
      }),
    ).toBe("acme/loop-keyword#loops");
  });
});
