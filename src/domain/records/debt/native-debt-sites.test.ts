import { describe, expect, it } from "vitest";

import type { AttributedCheckException, NamedGovernedRun } from "../../finding/governance.ts";
import type {
  Case,
  Check,
  Engine,
  Pointed,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { nativeDebtSitesOf } from "./native-debt-sites.ts";

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = {
  name: "external-behaviour-sits-at-a-boundary",
  title: "External behaviour sits at a boundary",
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const PORTS_DECLARED_INSIDE: Rule = {
  name: "ports-declared-inside",
  title: "Ports declared inside",
  principle: AT_A_BOUNDARY,
  standing: "accepted",
};

const WRITTEN_OUT_ANSWERS: Rule = {
  name: "written-out-answers",
  title: "Written-out answers",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DOER_OR_ORCHESTRATOR: Rule = {
  name: "doer-or-orchestrator",
  title: "Doer or orchestrator",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = {
  name: "does-one-job",
  title: "Does one job",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const CHECKS_A_VALUE: Case = {
  name: "checks-a-value-that-may-be-one-of-several-outcomes",
  title: "Checks a value that may be one of several outcomes",
  standing: "accepted",
  owes: [{ kind: "principle", principle: TESTS_ARE_OURS }],
};

const OWED_DECLARED_NOT_ASSERTED: Pointed = { kind: "rule", rule: DECLARED_NOT_ASSERTED };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [OWED_DECLARED_NOT_ASSERTED],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "assert-to-narrow",
  title: "Assert to narrow",
  standing: "accepted",
  reason: { text: "it narrows the type", standing: "accepted" },
};

const IT_EACH_OVER_TYPED_ROWS: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "it-each-over-typed-rows",
  title: "it.each over typed rows",
  standing: "accepted",
  reason: { text: "each row is a case", standing: "accepted" },
};

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

const DATE_USED_DIRECTLY: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: NEEDS_THE_CURRENT_TIME,
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: DOES_ONE_JOB, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [
    {
      situation: "correct use",
      kind: AUTHORISED_LOCATION_KIND,
      at: "on the clock adapter",
      binding: "check-and-file",
    },
  ],
};

const BRANCH_IN_A_TEST: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "`if` in a test file.",
  mayIndicate: [
    {
      case: CHECKS_A_VALUE,
      points: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "principle", principle: NO_HIDDEN_EFFECTS },
      ],
    },
  ],
  breachUsuallySits:
    "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, IT_EACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: GIVES_A_VALUE_ITS_TYPE,
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    {
      situation: "a schema proves the type",
      kind: AUTHORISED_LOCATION_KIND,
      binding: "check-and-file",
    },
  ],
};

const CLOCK_SOURCES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-17"),
  clause: clauseIdOf("clock-sources"),
};

const TEST_BODY_LOGIC = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const CAST_EXPRESSIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const CLOCK_CHECK: Check = {
  name: "clock-sources",
  symptom: DATE_USED_DIRECTLY,
  page: "date-used-directly/clock-sources.md",
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
  findingSpecifics: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  page: "branch-in-a-test/test-body.md",
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
  findingSpecifics: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [
    PORTS_DECLARED_INSIDE,
    WRITTEN_OUT_ANSWERS,
    DOER_OR_ORCHESTRATOR,
    STRAIGHT_THROUGH_TESTS,
    DECLARED_NOT_ASSERTED,
  ],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, IT_EACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ form: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE = repoPathOf("src/a.ts");

const OTHER_FILE = repoPathOf("src/b.ts");

const ESLINT_RUN: NamedGovernedRun = {
  nestedConfigurations: [],
  unprojectedFolders: [],
  mechanism: ESLINT,
  nativeExceptions: [],
  coverableKinds: ["config-override", "inline-disable"],
};

const INLINE_DISABLE: AttributedCheckException = {
  ruleSet: "hone",
  kind: "inline-disable",
  mechanism: ESLINT,
  check: "claimed-type#cast-expressions",
  file: FILE,
  line: 3,
  text: "// eslint-disable-next-line x",
  reach: "one-check",
};

const CONFIG_OVERRIDE: AttributedCheckException = {
  ruleSet: "hone",
  kind: "config-override",
  mechanism: ESLINT,
  check: "claimed-type#cast-expressions",
  file: OTHER_FILE,
};

const IGNORE: AttributedCheckException = {
  ruleSet: "hone",
  kind: "ignore",
  mechanism: ESLINT,
  check: "claimed-type#cast-expressions",
  file: FILE,
};

const NAMED_IGNORE: AttributedCheckException = {
  ...IGNORE,
  check: "claimed-type#cast-expressions",
  file: OTHER_FILE,
};

const OPTION: AttributedCheckException = {
  ruleSet: "hone",
  kind: "command-line-option",
  mechanism: ESLINT,
  check: "claimed-type#cast-expressions",
  location: repoPathOf("package.json"),
  script: "lint",
  option: "--no-inline-config",
  cause: { kind: "weakens-run" },
};

const UNRUN_MECHANISM_EXCEPTION: AttributedCheckException = {
  ...INLINE_DISABLE,
  mechanism: AUDIT,
};

describe("nativeDebtSitesOf", () => {
  it("names the check and file of each exception a run's records can hold, once each, as a debt that comes from a native exception", () => {
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [INLINE_DISABLE, INLINE_DISABLE],
        runs: [ESLINT_RUN],
      }),
    ).toEqual({
      recordable: [
        {
          ruleSet: TOOL_RULE_SET,
          address: "claimed-type#cast-expressions",
          file: FILE,
          origin: "native-exception",
        },
      ],
      unrecordable: [],
    });
  });

  it("retains the projection boundary for a native exception in the nested folder", () => {
    const folder = repoPathOf("src");
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [INLINE_DISABLE],
        runs: [{ ...ESLINT_RUN, unprojectedFolders: [{ folder, selectionFolder: folder }] }],
      }),
    ).toEqual({
      recordable: [
        {
          ruleSet: TOOL_RULE_SET,
          address: INLINE_DISABLE.check,
          file: FILE,
          origin: "native-exception",
          unprojected: { mechanism: ESLINT, folder, selectionFolder: folder },
        },
      ],
      unrecordable: [],
    });
  });

  it("never takes a config override for the source of a debt, though the run's records could hold it, since debt holds what is owed and an override on a clean file owes nothing", () => {
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [CONFIG_OVERRIDE],
        runs: [ESLINT_RUN],
      }),
    ).toEqual({
      recordable: [],
      unrecordable: [
        {
          address: "claimed-type#cast-expressions",
          file: OTHER_FILE,
          because: { kind: "config-override" },
        },
      ],
    });
  });

  it("keeps the cause of a script option, since the advice depends on it", () => {
    const wrapped: AttributedCheckException = {
      ...OPTION,
      cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
    };
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [OPTION, wrapped],
        runs: [ESLINT_RUN],
      }).unrecordable,
    ).toEqual([
      {
        address: "claimed-type#cast-expressions",
        file: "package.json",
        because: { kind: "command-line-option", cause: { kind: "weakens-run" } },
      },
      {
        address: "claimed-type#cast-expressions",
        file: "package.json",
        because: {
          kind: "command-line-option",
          cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
        },
      },
    ]);
  });

  it("names, by its kind, each exception no record can hold, with its check address", () => {
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [OPTION, NAMED_IGNORE, IGNORE],
        runs: [ESLINT_RUN],
      }),
    ).toEqual({
      recordable: [],
      unrecordable: [
        {
          address: "claimed-type#cast-expressions",
          file: "package.json",
          because: { kind: "command-line-option", cause: { kind: "weakens-run" } },
        },
        { address: "claimed-type#cast-expressions", file: FILE, because: { kind: "ignore" } },
        { address: "claimed-type#cast-expressions", file: OTHER_FILE, because: { kind: "ignore" } },
      ],
    });
  });

  it("names an exception of a kind the run's records do not hold by its kind, whichever kind it is", () => {
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [INLINE_DISABLE],
        runs: [{ ...ESLINT_RUN, coverableKinds: [] }],
      }),
    ).toEqual({
      recordable: [],
      unrecordable: [
        {
          address: "claimed-type#cast-expressions",
          file: FILE,
          because: { kind: "inline-disable" },
        },
      ],
    });
  });

  it("names an exception of a mechanism that did not run by its kind", () => {
    expect(
      nativeDebtSitesOf({
        catalogue: REPORT_CATALOGUE,
        unrecorded: [UNRUN_MECHANISM_EXCEPTION],
        runs: [ESLINT_RUN],
      }),
    ).toEqual({
      recordable: [],
      unrecordable: [
        {
          address: "claimed-type#cast-expressions",
          file: FILE,
          because: { kind: "inline-disable" },
        },
      ],
    });
  });

  it("names nothing when no exception is unrecorded", () => {
    expect(
      nativeDebtSitesOf({ catalogue: REPORT_CATALOGUE, unrecorded: [], runs: [ESLINT_RUN] }),
    ).toEqual({ recordable: [], unrecordable: [] });
  });
});
