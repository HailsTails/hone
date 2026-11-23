import { describe, expect, it } from "vitest";

import type { CheckFinding } from "../../domain/finding/governance.ts";
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
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { PlacedRecord, SymptomReach } from "../../domain/records/hone-records/hone-record.ts";
import type { WhyChain } from "../../domain/records/why-chain.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import type { VersionTwoReportOutput } from "../../domain/settings/report-output.ts";
import {
  assessmentScopeOf,
  renderRunReportText,
  renderRunSectionsText,
} from "./run-report-text.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const SYMPTOM_PAGE = "node_modules/@hailstails/hone/rules/typescript/symptoms.md";

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

const ITEACH_OVER_TYPED_ROWS: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "iteach-over-typed-rows",
  title: "it.each over typed rows",
  standing: "accepted",
  reason: { text: "each row is a case", standing: "accepted" },
};

const BOUNDARY_RECORD_KIND: RecordKind = {
  name: "boundary-record",
  title: "Boundary record",
  phrase: "a boundary record",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
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
    { situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" },
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
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
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
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
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
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
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
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ section: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const PROJECT_COMMAND =
  "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

const PRUNE_COMMAND =
  "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop";

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const WEBHOOK_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const CLOCK_FINDING: CheckFinding = {
  check: "date-used-directly#clock-sources",
  mechanism: AUDIT,
  file: ORDER_FILE,
  anchor: { line: 14, column: 0 },
  snippet: "clock.now()",
};

const CAST_FINDING: CheckFinding = {
  check: "claimed-type#cast-expressions",
  mechanism: ESLINT,
  file: WEBHOOK_FILE,
  anchor: { line: 4, column: 9 },
  snippet: "body as Event",
};

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "stated" },
  },
};

const NOTED_LOCATION: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: {
      held: "stated",
      owing: {
        matches: "not-the-catalogue",
        note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" },
      },
      whyChain: CAUSAL_WHY_CHAIN,
    },
  },
};

const EMPTY_REPORT: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  held: [],
  available: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  "projection-problems": [],
  assessment: [],
  "settings-notes": [],
  "record-notes": [],
  carried: [],
  symptoms: [],
};

const EVERY_SECTION: RunReport = {
  excluded: [repoPathOf("dist")],
  "not-adopted": [CAST_CHECK],
  "not-run": [TEST_BODY_CHECK],
  editions: [
    { check: CLOCK_CHECK, engine: WALKER, edition: editionOf("1"), latest: editionOf("2") },
  ],
  findings: [CLOCK_FINDING],
  answered: [{ finding: CAST_FINDING, by: [NOTED_LOCATION] }],
  held: [
    {
      exception: {
        kind: "inline-disable",
        check: "claimed-type#cast-expressions",
        file: WEBHOOK_FILE,
        line: 8,
        text: "// eslint-disable-next-line @typescript-eslint/consistent-type-assertions",
        reach: "one-check",
        mechanism: ESLINT,
      },
      by: [NOTED_LOCATION],
    },
  ],
  available: [CLOCK_CHECK],
  stale: [{ placed: NOTED_LOCATION, reason: "credited-nothing" }],
  forfeited: [DEBT],
  unrecorded: [
    {
      kind: "ignore",
      check: "claimed-type#cast-expressions",
      file: WEBHOOK_FILE,
      mechanism: ESLINT,
    },
  ],
  misnamed: [
    {
      kind: "version-1-id",
      ruleId: "hone/no-class-authoring",
      file: WEBHOOK_FILE,
      line: 3,
      text: "// eslint-disable-next-line hone/no-class-authoring",
      replacedBy: ["hone/authored-class-or-this#class-keyword"],
    },
  ],
  paid: [{ debt: DEBT, answeredBy: [NOTED_LOCATION] }],
  refused: [
    {
      place: { file: AUTHORISED_FILE, index: 1 },
      refusals: [{ kind: "carried-changed-since-base" }],
    },
  ],
  unmeasured: [{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }],
  "projection-problems": [{ scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }],
  assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 2 }],
  "settings-notes": [{ kind: "declared-not-read", key: "layers" }],
  "record-notes": [
    {
      place: NOTED_LOCATION.place,
      note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" },
    },
  ],
  carried: [
    { place: { file: AUTHORISED_FILE, index: 2 }, lacks: ["case"], standing: "established" },
  ],
  symptoms: [DATE_USED_DIRECTLY],
};

const NOTE = 'note: gives-a-value-its-type does not owe "written-out-answers"';

const LINES = {
  excluded: "dist",
  notAdopted: "claimed-type#cast-expressions",
  notRun: "branch-in-a-test#test-body adopted, engine not run: enforced by review",
  editions: "date-used-directly#clock-sources walker edition 1 of 2",
  findings: `date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 clock.now() symptom: date-used-directly (${SYMPTOM_PAGE}#date-used-directly) may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator`,
  answered: `claimed-type#cast-expressions eslint src/adapters/stripe-webhook.ts:4:9 body as Event answered by authorised-location ${NOTE}`,
  held: `claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:8 // eslint-disable-next-line @typescript-eslint/consistent-type-assertions held by authorised-location ${NOTE}`,
  available: "date-used-directly#clock-sources",
  stale: `claimed-type authorised-location src/adapters/stripe-webhook.ts ${NOTE}`,
  forfeited: `claimed-type debt src/adapters/stripe-webhook.ts; this change touched its file, so it no longer answers: fix what it held, then run ${PRUNE_COMMAND} to remove it`,
  unrecorded: "claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts",
  misnamed:
    "src/adapters/stripe-webhook.ts:3 version-1-id hone/no-class-authoring write hone/authored-class-or-this#class-keyword // eslint-disable-next-line hone/no-class-authoring",
  paid: `claimed-type debt src/adapters/stripe-webhook.ts answered by authorised-location ${NOTE}; run ${PRUNE_COMMAND} to remove the paid debt`,
  refused:
    "hone-records/authorised-locations/claimed-type.json records[1] carried-changed-since-base",
  unmeasured:
    'forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere',
  projectionProblems: `eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run ${PROJECT_COMMAND} and commit every file it writes`,
  assessment: "forfeiture elsewhere: 2 debt records not checked for forfeiture in this run",
  notes: "layers is declared; no check reads it yet",
  recordNotes:
    'hone-records/authorised-locations/claimed-type.json records[0] owes-not-owed: gives-a-value-its-type does not owe "written-out-answers"',
  carried: "hone-records/authorised-locations/claimed-type.json records[2] established lacks case",
  symptoms: `date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Read ${SYMPTOM_PAGE}#date-used-directly`,
};

const rendered = (request: {
  readonly report: RunReport;
  readonly output: VersionTwoReportOutput;
}): string =>
  renderRunReportText({
    ...request,
    catalogue: REPORT_CATALOGUE,
    symptomPage: SYMPTOM_PAGE,
    projectCommand: PROJECT_COMMAND,
    pruneCommand: PRUNE_COMMAND,
  });

describe("renderRunReportText", () => {
  it("prints only the verdict for a run with nothing to report", () => {
    expect(rendered({ report: EMPTY_REPORT, output: "full" })).toBe("verdict: pass\n");
  });

  it("prints every non-empty section in order, each headed by its count, then the verdict", () => {
    expect(rendered({ report: EVERY_SECTION, output: "full" })).toBe(
      `excluded (1)\n${LINES.excluded}\nnot-adopted (1)\n${LINES.notAdopted}\nnot-run (1)\n${LINES.notRun}\neditions (1)\n${LINES.editions}\nfindings (1)\n${LINES.findings}\nanswered (1)\n${LINES.answered}\nheld (1)\n${LINES.held}\navailable (1)\n${LINES.available}\nstale (1)\n${LINES.stale}\nforfeited (1)\n${LINES.forfeited}\nunrecorded (1)\n${LINES.unrecorded}\nmisnamed (1)\n${LINES.misnamed}\npaid (1)\n${LINES.paid}\nrefused (1)\n${LINES.refused}\nunmeasured (1)\n${LINES.unmeasured}\nprojection-problems (1)\n${LINES.projectionProblems}\nassessment (1)\n${LINES.assessment}\nsettings-notes (1)\n${LINES.notes}\nrecord-notes (1)\n${LINES.recordNotes}\ncarried (1)\n${LINES.carried}\nsymptoms (1)\n${LINES.symptoms}\nverdict: fail (partial assessment)\n`,
    );
  });

  it("leaves out the informational sections when it prints failures only, and keeps paid debt, whose next step a hook must see", () => {
    expect(rendered({ report: EVERY_SECTION, output: "actionable" })).toBe(
      `findings (1)\n${LINES.findings}\nstale (1)\n${LINES.stale}\nforfeited (1)\n${LINES.forfeited}\nunrecorded (1)\n${LINES.unrecorded}\nmisnamed (1)\n${LINES.misnamed}\npaid (1)\n${LINES.paid}\nrefused (1)\n${LINES.refused}\nunmeasured (1)\n${LINES.unmeasured}\nprojection-problems (1)\n${LINES.projectionProblems}\nsymptoms (1)\n${LINES.symptoms}\nverdict: fail (partial assessment)\n`,
    );
  });

  it("prints each section's heading alone, naming the role of each that does not fail the run, when it prints counts", () => {
    expect(rendered({ report: EVERY_SECTION, output: "counts" })).toBe(
      `excluded (1) informational\nnot-adopted (1) informational\nnot-run (1) informational\neditions (1) informational\nfindings (1)\nanswered (1) informational\nheld (1) informational\navailable (1) informational\nstale (1)\nforfeited (1)\nunrecorded (1)\nmisnamed (1)\npaid (1) next-step\nrefused (1)\nunmeasured (1)\nprojection-problems (1)\nassessment (1) informational\nsettings-notes (1) informational\nrecord-notes (1) informational\ncarried (1) informational\nsymptoms (1) guidance\nverdict: fail (partial assessment)\n`,
    );
  });

  it("prints the verdict alone when it prints the verdict only", () => {
    expect(rendered({ report: EVERY_SECTION, output: "verdict-only" })).toBe(
      "verdict: fail (partial assessment)\n",
    );
  });

  it("passes a run whose answered finding and held inline disable carry a catalogue note, with its notes, carried records and symptoms", () => {
    expect(
      rendered({
        report: {
          ...EMPTY_REPORT,
          answered: EVERY_SECTION.answered,
          held: EVERY_SECTION.held,
          "settings-notes": EVERY_SECTION["settings-notes"],
          carried: EVERY_SECTION.carried,
          symptoms: EVERY_SECTION.symptoms,
        },
        output: "verdict-only",
      }),
    ).toBe("verdict: pass\n");
  });

  it("prints a record's catalogue note under record-notes though the record answers no finding, and passes the run", () => {
    expect(
      rendered({
        report: { ...EMPTY_REPORT, "record-notes": EVERY_SECTION["record-notes"] },
        output: "full",
      }),
    ).toBe(`record-notes (1)\n${LINES.recordNotes}\nverdict: pass\n`);
  });

  it("passes a run whose only entry is paid debt, and prints it with its next step when it prints failures only", () => {
    expect(
      rendered({ report: { ...EMPTY_REPORT, paid: EVERY_SECTION.paid }, output: "actionable" }),
    ).toBe(`paid (1)\n${LINES.paid}\nverdict: pass\n`);
  });

  it("passes a run with a partial assessment and says so", () => {
    expect(
      rendered({
        report: { ...EMPTY_REPORT, assessment: EVERY_SECTION.assessment },
        output: "verdict-only",
      }),
    ).toBe("verdict: pass (partial assessment)\n");
  });

  it("fails a run with a refused record and nothing else", () => {
    expect(
      rendered({
        report: { ...EMPTY_REPORT, refused: EVERY_SECTION.refused },
        output: "verdict-only",
      }),
    ).toBe("verdict: fail\n");
  });
});

describe("renderRunSectionsText", () => {
  it("prints every non-empty section in order without a verdict line", () => {
    expect(
      renderRunSectionsText({
        report: {
          ...EMPTY_REPORT,
          findings: EVERY_SECTION.findings,
          refused: EVERY_SECTION.refused,
        },
        output: "full",
        catalogue: REPORT_CATALOGUE,
        symptomPage: SYMPTOM_PAGE,
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
      }),
    ).toBe(`findings (1)\n${LINES.findings}\nrefused (1)\n${LINES.refused}\n`);
  });

  it("prints nothing for a run with nothing to report", () => {
    expect(
      renderRunSectionsText({
        report: EMPTY_REPORT,
        output: "full",
        catalogue: REPORT_CATALOGUE,
        symptomPage: SYMPTOM_PAGE,
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
      }),
    ).toBe("");
  });
});

describe("assessmentScopeOf", () => {
  it("marks nothing when the whole assessment ran here", () => {
    expect(assessmentScopeOf({ report: EMPTY_REPORT })).toBe("");
  });

  it("marks a partial assessment when part of it was left to another run", () => {
    expect(
      assessmentScopeOf({ report: { ...EMPTY_REPORT, assessment: EVERY_SECTION.assessment } }),
    ).toBe(" (partial assessment)");
  });
});
