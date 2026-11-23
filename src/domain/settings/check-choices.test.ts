import { describe, expect, it } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../language-layer/symptom-catalogue.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import {
  type CheckChoiceRefusal,
  namedCheckChoicesOf,
  type RuleSetCatalogue,
} from "./check-choices.ts";
import type { GivenCheckSettings, ListedCheck } from "./settings-file.ts";

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
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT],
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

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER, ESLINT],
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
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: "hone", catalogue: SETTINGS_CATALOGUE },
];

const TEAM = { name: ruleSetNameOf("team") };

const LISTED_TEST_BODY: readonly ListedCheck[] = [
  {
    address: { ruleSet: "hone", check: "loop-keyword#test-body" },
    state: { state: "run", engine: "walker" },
  },
  {
    address: { ruleSet: "hone", check: "rebinding#test-body" },
    state: { state: "run", engine: "walker" },
  },
];

const LISTED_LOOPS: ListedCheck = {
  address: { ruleSet: "hone", check: "loop-keyword#loops" },
  state: { state: "not-adopted" },
};

describe("namedCheckChoicesOf", () => {
  it("keeps different editions for two checks that share an implementation", () => {
    const first: GivenCheckSettings = {
      address: { ruleSet: "hone", check: "loop-keyword#test-body" },
      values: { edition: "1" },
    };
    const second: GivenCheckSettings = {
      address: { ruleSet: "hone", check: "rebinding#test-body" },
      values: { edition: "2" },
    };
    expect(
      namedCheckChoicesOf({
        catalogues: CATALOGUES,
        checks: LISTED_TEST_BODY,
        checkSettings: [first, second],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        checks: [
          {
            address: first.address,
            check: LOOP_KEYWORD_TEST_BODY,
            choice: { state: "run", mechanism: "walker", settings: first },
          },
          {
            address: second.address,
            check: REBINDING_TEST_BODY,
            choice: { state: "run", mechanism: "walker", settings: second },
          },
        ],
        available: [LOOP_KEYWORD_LOOPS],
      },
    });
  });

  it("allows one check to run when another check of the same piece is off", () => {
    expect(
      namedCheckChoicesOf({
        catalogues: CATALOGUES,
        checks: [
          {
            address: { ruleSet: "hone", check: "loop-keyword#test-body" },
            state: { state: "run", engine: "walker" },
          },
          {
            address: { ruleSet: "hone", check: "rebinding#test-body" },
            state: { state: "not-adopted" },
          },
        ],
        checkSettings: [],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        checks: [
          { check: LOOP_KEYWORD_TEST_BODY, choice: { state: "run" } },
          { check: REBINDING_TEST_BODY, choice: { state: "not-adopted" } },
        ],
      },
    });
  });
  it("runs one check while its sibling on the same piece is unlisted", () => {
    const [listed] = LISTED_TEST_BODY;
    expect(
      namedCheckChoicesOf({ catalogues: CATALOGUES, checks: [listed], checkSettings: [] }),
    ).toEqual({
      outcome: "ok",
      value: {
        checks: [
          {
            address: listed.address,
            check: LOOP_KEYWORD_TEST_BODY,
            choice: { state: "run", mechanism: "walker", settings: undefined },
          },
        ],
        available: [LOOP_KEYWORD_LOOPS],
      },
    });
  });

  it("applies supplied settings only to the selected check that owns them", () => {
    const settings: GivenCheckSettings = {
      address: LISTED_TEST_BODY[1].address,
      values: { edition: "2" },
    };
    expect(
      namedCheckChoicesOf({
        catalogues: CATALOGUES,
        checks: LISTED_TEST_BODY,
        checkSettings: [settings],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        checks: [
          { check: LOOP_KEYWORD_TEST_BODY, choice: { state: "run", settings: undefined } },
          { check: REBINDING_TEST_BODY, choice: { state: "run", settings } },
        ],
      },
    });
  });

  it("offers as available every check of a listed symptom that is listed nowhere", () => {
    expect(
      namedCheckChoicesOf({ catalogues: CATALOGUES, checks: LISTED_TEST_BODY, checkSettings: [] }),
    ).toMatchObject({
      outcome: "ok",
      value: { available: [LOOP_KEYWORD_LOOPS] },
    });
  });

  it("chooses only the listed checks when the catalogue gains a check under a listed symptom, and offers the new check as available", () => {
    const rebindingLayering: Check = {
      name: "layering",
      symptom: REBINDING,
      clause: LAYERING_CLAUSE,
      engines: [WALKER],
      forms: [],
    };
    const grown: readonly RuleSetCatalogue[] = [
      {
        ruleSet: "hone",
        catalogue: {
          ...SETTINGS_CATALOGUE,
          checks: [...SETTINGS_CATALOGUE.checks, rebindingLayering],
        },
      },
    ];
    expect(
      namedCheckChoicesOf({
        catalogues: grown,
        checks: [...LISTED_TEST_BODY, LISTED_LOOPS],
        checkSettings: [],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        checks: [
          {
            address: LISTED_TEST_BODY[0].address,
            check: LOOP_KEYWORD_TEST_BODY,
            choice: { state: "run", mechanism: "walker", settings: undefined },
          },
          {
            address: LISTED_TEST_BODY[1].address,
            check: REBINDING_TEST_BODY,
            choice: { state: "run", mechanism: "walker", settings: undefined },
          },
          {
            address: LISTED_LOOPS.address,
            check: LOOP_KEYWORD_LOOPS,
            choice: { state: "not-adopted" },
          },
        ],
        available: [rebindingLayering],
      },
    });
  });

  type RefusalRow = {
    readonly name: string;
    readonly checks: readonly ListedCheck[];
    readonly checkSettings: readonly GivenCheckSettings[];
    readonly refusal: CheckChoiceRefusal;
  };

  it.each<RefusalRow>([
    {
      name: "a check no catalogue holds",
      checks: [
        {
          address: { ruleSet: "hone", check: "loop-keyword#nowhere" },
          state: { state: "run", engine: "walker" },
        },
      ],
      checkSettings: [],
      refusal: { kind: "unknown-check", address: "loop-keyword#nowhere" },
    },
    {
      name: "a check in a rule set with no catalogue yet",
      checks: [
        {
          address: { ruleSet: TEAM, check: "loop-keyword#loops" },
          state: { state: "run", engine: "walker" },
        },
      ],
      checkSettings: [],
      refusal: { kind: "unknown-check", address: "team/loop-keyword#loops" },
    },
    {
      name: "a review-only clause listed as a check of a symptom it sees",
      checks: [
        { address: { ruleSet: "hone", check: "rebinding#layering" }, state: { state: "not-run" } },
      ],
      checkSettings: [],
      refusal: { kind: "review-only-listed", address: "rebinding#layering" },
    },
    {
      name: "a check run by an engine it does not have",
      checks: [
        {
          address: { ruleSet: "hone", check: "loop-keyword#test-body" },
          state: { state: "run", engine: "eslint" },
        },
      ],
      checkSettings: [],
      refusal: {
        kind: "engine-not-allowed",
        address: "loop-keyword#test-body",
        engine: "eslint",
        engines: ["walker"],
      },
    },
    {
      name: "a check listed twice, once with Hone's rule set named",
      checks: [
        LISTED_LOOPS,
        { address: { ruleSet: "hone", check: "loop-keyword#loops" }, state: { state: "not-run" } },
      ],
      checkSettings: [],
      refusal: {
        kind: "duplicate-check",
        key: "checks",
        address: "loop-keyword#loops",
        prefixedAddress: "hone/loop-keyword#loops",
      },
    },
    {
      name: "settings on a check that is not adopted",
      checks: [LISTED_LOOPS],
      checkSettings: [
        { address: { ruleSet: "hone", check: "loop-keyword#loops" }, values: { edition: "2" } },
      ],
      refusal: {
        kind: "check-settings-refused",
        address: "loop-keyword#loops",
        listing: "not-adopted",
      },
    },
    {
      name: "settings on a check that is not listed",
      checks: LISTED_TEST_BODY,
      checkSettings: [
        { address: { ruleSet: "hone", check: "loop-keyword#loops" }, values: { edition: "2" } },
      ],
      refusal: {
        kind: "check-settings-refused",
        address: "loop-keyword#loops",
        listing: "unlisted",
      },
    },
    {
      name: "settings on an unknown check",
      checks: LISTED_TEST_BODY,
      checkSettings: [
        { address: { ruleSet: "hone", check: "loop-keyword#nowhere" }, values: { edition: "2" } },
      ],
      refusal: { kind: "unknown-check", address: "loop-keyword#nowhere" },
    },
    {
      name: "settings given twice for one check",
      checks: LISTED_TEST_BODY,
      checkSettings: [
        { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "2" } },
        { address: { ruleSet: "hone", check: "rebinding#test-body" }, values: { edition: "1" } },
      ],
      refusal: {
        kind: "duplicate-check",
        key: "checkSettings",
        address: "rebinding#test-body",
        prefixedAddress: "hone/rebinding#test-body",
      },
    },
  ])("refuses $name", ({ checks, checkSettings, refusal }) => {
    expect(namedCheckChoicesOf({ catalogues: CATALOGUES, checks, checkSettings })).toEqual({
      outcome: "failed",
      error: refusal,
    });
  });
});
