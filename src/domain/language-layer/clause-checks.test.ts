import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import type { RuleSetCatalogue } from "../settings/check-choices.ts";
import { checksOfClause, createClauseChecks, readChecksOfClause } from "./clause-checks.ts";
import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "./symptom-catalogue.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
  findingSpecifics: [],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { form: "a-for-loop", symptom: LOOP_KEYWORD },
          { form: "a-let", symptom: REBINDING },
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

describe("checksOfClause", () => {
  it("finds the one check of a clause in its rule set's catalogue", () => {
    expect(checksOfClause({ catalogues: CATALOGUES, clause: LOOPS_CLAUSE })).toEqual([
      LOOP_KEYWORD_LOOPS,
    ]);
  });

  it("finds each check of a clause that has two", () => {
    expect(checksOfClause({ catalogues: CATALOGUES, clause: TEST_BODY_CLAUSE })).toEqual([
      SETTINGS_CATALOGUE.checks[1],
      SETTINGS_CATALOGUE.checks[2],
    ]);
  });

  it("finds nothing for a clause that has no check", () => {
    expect(
      checksOfClause({
        catalogues: CATALOGUES,
        clause: {
          ruleSet: TOOL_RULE_SET,
          discipline: disciplineIdOf("CD-13"),
          clause: clauseIdOf("layering"),
        },
      }),
    ).toEqual([]);
  });

  it("finds nothing for a clause of a rule set that has no catalogue", () => {
    expect(
      checksOfClause({
        catalogues: CATALOGUES,
        clause: {
          ruleSet: { name: ruleSetNameOf("team") },
          discipline: disciplineIdOf("CD-15"),
          clause: clauseIdOf("loops"),
        },
      }),
    ).toEqual([]);
  });
});

describe("createClauseChecks", () => {
  it("holds each clause a check names under its address, with every check of that clause", () => {
    const clauseChecks = createClauseChecks({ catalogues: CATALOGUES });

    expect(clauseChecks).toEqual(
      new Map([
        ["CD-15#loops", [LOOP_KEYWORD_LOOPS]],
        ["CD-27#test-body-logic", [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY]],
      ]),
    );
  });

  it("holds a team's clause under its rule set's name", () => {
    const team = { name: ruleSetNameOf("team") };
    const teamClause = {
      ruleSet: team,
      discipline: disciplineIdOf("TM-1"),
      clause: clauseIdOf("no-tmp-files"),
    };
    const teamCheck: Check = { ...LOOP_KEYWORD_LOOPS, clause: teamClause };

    const clauseChecks = createClauseChecks({
      catalogues: [{ catalogue: { ...SETTINGS_CATALOGUE, checks: [teamCheck] } }],
    });

    expect(clauseChecks).toEqual(new Map([["team/TM-1#no-tmp-files", [teamCheck]]]));
  });
});

describe("readChecksOfClause", () => {
  it("reads the checks held under a clause's address", () => {
    const checks = readChecksOfClause({
      clauseChecks: new Map([["CD-15#loops", [LOOP_KEYWORD_LOOPS]]]),
      clause: LOOPS_CLAUSE,
    });

    expect(checks).toEqual([LOOP_KEYWORD_LOOPS]);
  });

  it("reads no check for a clause nothing is held under", () => {
    const checks = readChecksOfClause({ clauseChecks: new Map(), clause: LAYERING_CLAUSE });

    expect(checks).toEqual([]);
  });
});
