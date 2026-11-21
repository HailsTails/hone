import { describe, expect, it } from "vitest";
import {
  AUDIT,
  CAST_CHECK,
  CAST_EXPRESSIONS,
  CHECKS_PAGE,
  CLOCK_CHECK,
  CLOCK_SOURCES,
  ESLINT,
  ESLINT_ENGINE,
  REPORT_CATALOGUE,
  TEAM_CLAUSE,
  TEST_BODY_CHECK,
  TEST_BODY_LOGIC,
  WALKER,
} from "../../../tests/report-catalogue.ts";
import type { Finding } from "../../infrastructure/command-line/governance.ts";
import type { Check, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { checkSiteText, findingSiteOf, nativeSitesOf } from "./check-site.ts";

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

const UNFORMED_FINDING: Finding = { clause: TEST_BODY_LOGIC, mechanism: AUDIT, file: FILE, anchor: { line: 22, column: 2 }, snippet: "if (result.ok) {" };

const TEAM_FINDING: Finding = { clause: TEAM_CLAUSE, mechanism: ESLINT, file: FILE, anchor: { line: 1, column: 0 }, snippet: "moment()" };

const ANGLE_BRACKETS_CHECK: Check = { name: "angle-brackets", symptom: CAST_CHECK.symptom, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const TWO_CAST_CHECKS: SymptomCatalogue = { ...REPORT_CATALOGUE, checks: [...REPORT_CATALOGUE.checks, ANGLE_BRACKETS_CHECK] };

const CAST_FINDING: Finding = { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: FILE, anchor: { line: 3, column: 4 }, snippet: "<A>b" };

describe("findingSiteOf, a finding that names its check", () => {
  it("names that check, not the first check of the symptom", () => {
    expect(findingSiteOf({ catalogue: TWO_CAST_CHECKS, finding: { ...CAST_FINDING, check: "claimed-type#angle-brackets" } })).toEqual({
      sited: "check",
      check: ANGLE_BRACKETS_CHECK,
      engine: ESLINT_ENGINE,
    });
  });

  it("names the clause and mechanism when the clause has no such check", () => {
    expect(findingSiteOf({ catalogue: TWO_CAST_CHECKS, finding: { ...CAST_FINDING, check: "claimed-type#loops" } })).toEqual({
      sited: "unchecked",
      clause: CAST_EXPRESSIONS,
      mechanism: ESLINT,
    });
  });
});

describe("nativeSitesOf, an exception that names its check", () => {
  it("names only that check", () => {
    expect(
      nativeSitesOf({ catalogue: TWO_CAST_CHECKS, exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: FILE, mechanism: ESLINT, check: "claimed-type#angle-brackets" } }),
    ).toEqual([{ sited: "check", check: ANGLE_BRACKETS_CHECK, engine: ESLINT_ENGINE }]);
  });

  it("names every check of the clause on that engine when it names none", () => {
    expect(nativeSitesOf({ catalogue: TWO_CAST_CHECKS, exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: FILE, mechanism: ESLINT } })).toEqual([
      { sited: "check", check: CAST_CHECK, engine: ESLINT_ENGINE },
      { sited: "check", check: ANGLE_BRACKETS_CHECK, engine: ESLINT_ENGINE },
    ]);
  });

  it("names the clause and mechanism when the clause has no such check", () => {
    expect(
      nativeSitesOf({ catalogue: TWO_CAST_CHECKS, exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: FILE, mechanism: ESLINT, check: "claimed-type#loops" } }),
    ).toEqual([{ sited: "unchecked", clause: CAST_EXPRESSIONS, mechanism: ESLINT }]);
  });
});

describe("findingSiteOf", () => {
  it("names the check and engine that saw a finding of a clause with one symptom", () => {
    expect(findingSiteOf({ catalogue: REPORT_CATALOGUE, finding: CLOCK_FINDING })).toEqual({ sited: "check", check: CLOCK_CHECK, engine: WALKER });
  });

  it("names the check of the form a split clause's finding flagged", () => {
    expect(findingSiteOf({ catalogue: REPORT_CATALOGUE, finding: BRANCH_FINDING })).toEqual({ sited: "check", check: TEST_BODY_CHECK, engine: WALKER });
  });

  it("names the clause and mechanism of a split clause's finding that names no form", () => {
    expect(findingSiteOf({ catalogue: REPORT_CATALOGUE, finding: UNFORMED_FINDING })).toEqual({ sited: "unchecked", clause: TEST_BODY_LOGIC, mechanism: AUDIT });
  });

  it("names the clause and mechanism of a finding the catalogue has no check for", () => {
    expect(findingSiteOf({ catalogue: REPORT_CATALOGUE, finding: TEAM_FINDING })).toEqual({ sited: "unchecked", clause: TEAM_CLAUSE, mechanism: ESLINT });
  });

  it("names the clause and mechanism of a finding from a mechanism its check does not run on", () => {
    expect(findingSiteOf({ catalogue: REPORT_CATALOGUE, finding: { ...CLOCK_FINDING, mechanism: ESLINT } })).toEqual({
      sited: "unchecked",
      clause: CLOCK_SOURCES,
      mechanism: ESLINT,
    });
  });
});

describe("nativeSitesOf", () => {
  it("names each check of the suppressed clause that runs on the suppressing engine", () => {
    expect(nativeSitesOf({ catalogue: REPORT_CATALOGUE, exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: FILE, mechanism: ESLINT } })).toEqual([
      { sited: "check", check: CAST_CHECK, engine: ESLINT_ENGINE },
    ]);
  });

  it("names the clause and mechanism when no check of the clause runs on that engine", () => {
    expect(nativeSitesOf({ catalogue: REPORT_CATALOGUE, exception: { kind: "ignore", clause: TEAM_CLAUSE, file: FILE, mechanism: ESLINT } })).toEqual([
      { sited: "unchecked", clause: TEAM_CLAUSE, mechanism: ESLINT },
    ]);
  });
});

describe("checkSiteText", () => {
  it("prints a check's address and its engine's name", () => {
    expect(checkSiteText({ site: { sited: "check", check: TEST_BODY_CHECK, engine: WALKER } })).toBe("branch-in-a-test#test-body walker");
  });

  it("prints a clause the catalogue has no check for by its address and mechanism", () => {
    expect(checkSiteText({ site: { sited: "unchecked", clause: TEAM_CLAUSE, mechanism: ESLINT } })).toBe("acme/AC-1#no-moment eslint");
  });
});
