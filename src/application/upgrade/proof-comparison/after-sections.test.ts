import { describe, expect, it } from "vitest";

import type { CheckFinding } from "../../../domain/finding/governance.ts";
import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { PlacedRecord } from "../../../domain/records/hone-records/hone-record.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { afterSectionsOf } from "./after-sections.ts";

const AUDIT = "walker" as const;

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

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
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
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

const SRC_A = repoPathOf("src/a.ts");

const EMPTY_AFTER: RunReport = {
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

const NAMED_LOOP_FINDING: CheckFinding = {
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/loop-keyword.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: LOOP_KEYWORD_LOOPS.symptom,
    reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS },
    file: SRC_A,
    holding: { held: "stated" },
  },
};

const CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE },
];

const sectionsOf = (request: { readonly report: RunReport }) =>
  afterSectionsOf({ report: request.report, catalogues: CATALOGUES });

const sectionsOfWithoutCatalogues = (request: { readonly report: RunReport }) =>
  afterSectionsOf({ report: request.report, catalogues: [] });

describe("afterSectionsOf", () => {
  it("keys a named edition using the clause held only in the upgrade catalogue", () => {
    const editions = sectionsOf({
      report: {
        ...EMPTY_AFTER,
        editions: [
          {
            check: { ...LOOP_KEYWORD_LOOPS, clause: undefined },
            engine: WALKER,
            edition: editionOf("1"),
            latest: editionOf("2"),
          },
        ],
      },
    }).editions;
    expect(editions).toEqual(["CD-15#loops walker 1 2"]);
  });

  it("keys a team check by its own clause where Hone holds a check of the same address", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamLoops = {
      ...LOOP_KEYWORD_LOOPS,
      symptom: { ...LOOP_KEYWORD_LOOPS.symptom, ruleSet: acme },
      clause: { ruleSet: acme, discipline: disciplineIdOf("TM-1"), clause: clauseIdOf("loops") },
    };
    const editions = afterSectionsOf({
      report: {
        ...EMPTY_AFTER,
        editions: [
          {
            check: { ...teamLoops, clause: undefined },
            engine: WALKER,
            edition: editionOf("1"),
            latest: editionOf("2"),
          },
        ],
      },
      catalogues: [
        ...CATALOGUES,
        { ruleSet: acme, catalogue: { ...SETTINGS_CATALOGUE, checks: [teamLoops] } },
      ],
    }).editions;
    expect(editions).toEqual(["acme/TM-1#loops walker 1 2"]);
  });

  it("holds nothing but a passing verdict for a report that holds nothing", () => {
    expect(sectionsOf({ report: EMPTY_AFTER })).toEqual({
      excluded: [],
      findings: [],
      answered: [],
      unrecorded: [],
      misnamed: [],
      paid: [],
      stale: [],
      forfeited: [],
      "doubly-held": [],
      "invalid-records": [],
      "not-adopted": [],
      "not-run": [],
      editions: [],
      unmeasured: [],
      "projection-problems": [],
      assessment: [],
      verdict: ["pass"],
    });
  });

  it("keys each section of a report, a finding at the clause of the check it names and a record by its file", () => {
    expect(
      sectionsOf({
        report: {
          ...EMPTY_AFTER,
          excluded: [repoPathOf("generated")],
          findings: [{ ...NAMED_LOOP_FINDING, check: "rebinding#test-body" }],
          answered: [{ finding: NAMED_LOOP_FINDING, by: [DEBT] }],
          misnamed: [
            {
              kind: "names-no-check",
              ruleId: "hone/loop-keyword#none",
              file: SRC_A,
              line: 4,
              text: "eslint-disable",
            },
          ],
          paid: [{ debt: DEBT, answeredBy: [DEBT] }],
          stale: [{ placed: DEBT, reason: "credited-nothing" }],
          forfeited: [DEBT],
          available: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_LOOPS],
          "not-run": [LOOP_KEYWORD_LOOPS],
          "projection-problems": [
            {
              scope: "slice",
              engine: { name: "walker" },
              state: "missing",
              slice: repoPathOf("packages/web"),
            },
          ],
          unmeasured: [
            { kind: "engine-not-run", engine: { name: "walker" }, projection: "missing" },
          ],
          assessment: [
            { concern: "forfeiture", assessedBy: "elsewhere", debts: 1 },
            {
              concern: "nested-projection",
              engine: { name: "eslint" },
              folders: [repoPathOf("pkg")],
            },
          ],
        },
      }),
    ).toEqual({
      excluded: ["generated"],
      findings: ["CD-27#test-body-logic src/a.ts 3:1"],
      answered: ["CD-15#loops src/a.ts 3:1 answered by debt"],
      unrecorded: [],
      misnamed: ["names-no-check hone/loop-keyword#none src/a.ts 4"],
      paid: ["hone-records/debt/loop-keyword.json 0"],
      stale: ["src/a.ts"],
      forfeited: ["src/a.ts"],
      "doubly-held": [],
      "invalid-records": [],
      "not-adopted": [],
      "not-run": ["CD-15#loops"],
      editions: [],
      unmeasured: ["walker not-run missing"],
      "projection-problems": ["slice walker missing packages/web"],
      assessment: ["forfeiture elsewhere", "nested-projection eslint pkg"],
      verdict: ["fail"],
    });
  });

  it("keys an unmapped check as unknown without guessing a version one clause", () => {
    expect(
      sectionsOf({
        report: {
          ...EMPTY_AFTER,
          findings: [{ ...NAMED_LOOP_FINDING, check: "missing#unassigned" }],
        },
      }).findings,
    ).toEqual(["unknown-check missing#unassigned src/a.ts 3:1"]);
  });

  it("keys a finding naming a check the catalogue does not hold as that unknown check", () => {
    expect(
      sectionsOf({
        report: {
          ...EMPTY_AFTER,
          findings: [{ ...NAMED_LOOP_FINDING, check: "loop-keyword#lops" }],
        },
      }).findings,
    ).toEqual(["unknown-check loop-keyword#lops src/a.ts 3:1"]);
  });

  it("keys a finding of a rule set no catalogue was given for as an unknown check", () => {
    expect(
      sectionsOfWithoutCatalogues({ report: { ...EMPTY_AFTER, findings: [NAMED_LOOP_FINDING] } })
        .findings,
    ).toEqual(["unknown-check loop-keyword#loops src/a.ts 3:1"]);
  });
});
