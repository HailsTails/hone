import { describe, expect, it } from "vitest";
import {
  AUDIT,
  BRANCH_IN_A_TEST,
  CHECKS_PAGE,
  CLAIMED_TYPE,
  CLOCK_SOURCES,
  DATE_USED_DIRECTLY,
  ESLINT,
  REPORT_CATALOGUE,
  SYMPTOM_PAGE,
  TEAM_CLAUSE,
  TEST_BODY_LOGIC,
} from "../../../../tests/report-catalogue.ts";
import type { Finding } from "../../command-line/governance.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { findingSymptomsOf, symptomLine } from "./symptom-lines.ts";

const FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: FILE, anchor: { line: 14, column: 0 }, snippet: "clock.now()" };

const BRANCH_FINDING: Finding = {
  clause: TEST_BODY_LOGIC,
  mechanism: AUDIT,
  file: FILE,
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {",
  remedy: { fix: "write one test per case", page: CHECKS_PAGE, section: "branching-with-if" },
};

const TEAM_FINDING: Finding = { clause: TEAM_CLAUSE, mechanism: ESLINT, file: FILE, anchor: { line: 1, column: 0 }, snippet: "moment()" };

describe("symptomLine", () => {
  it("names a symptom's title, what it may indicate, where the breach sits, its recipe, each correct use, known debt and its page", () => {
    expect(symptomLine({ catalogue: REPORT_CATALOGUE, symptom: DATE_USED_DIRECTLY, page: SYMPTOM_PAGE })).toBe(
      `date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter. Known debt: debt. Read ${SYMPTOM_PAGE}#date-used-directly`,
    );
  });

  it("names several recipes, and only known debt when the symptom has no correct use", () => {
    expect(symptomLine({ catalogue: REPORT_CATALOGUE, symptom: BRANCH_IN_A_TEST, page: SYMPTOM_PAGE })).toBe(
      `branch-in-a-test: Branch in a test. May indicate: checks a value that may be one of several outcomes → Straight-through tests, No hidden effects. The breach usually sits in the unit's output type, where optional or loose shapes force the test to branch. Recipes: Assert to narrow; it.each over typed rows. Known debt: debt. Read ${SYMPTOM_PAGE}#branch-in-a-test`,
    );
  });

  it("names no recipe when the symptom has none, and an indication's situation after its case", () => {
    expect(symptomLine({ catalogue: REPORT_CATALOGUE, symptom: CLAIMED_TYPE, page: SYMPTOM_PAGE })).toBe(
      `claimed-type: Claimed type. May indicate: gives a value its type: or needs it narrower → Declared, not asserted. The breach usually sits at the producer. A schema proves the type: an authorised location. Known debt: debt. Read ${SYMPTOM_PAGE}#claimed-type`,
    );
  });
});

describe("findingSymptomsOf", () => {
  it("names each symptom the findings were seen as, once, in the order the findings first name them", () => {
    expect(findingSymptomsOf({ catalogue: REPORT_CATALOGUE, findings: [BRANCH_FINDING, CLOCK_FINDING, BRANCH_FINDING] })).toEqual([BRANCH_IN_A_TEST, DATE_USED_DIRECTLY]);
  });

  it("names no symptom for a finding the catalogue has no check for", () => {
    expect(findingSymptomsOf({ catalogue: REPORT_CATALOGUE, findings: [TEAM_FINDING] })).toEqual([]);
  });
});
