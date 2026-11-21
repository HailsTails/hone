import { describe, expect, it } from "vitest";
import {
  AUDIT,
  CAST_CHECK,
  CAST_EXPRESSIONS,
  CHECKS_PAGE,
  CLAIMED_TYPE,
  CLOCK_CHECK,
  CLOCK_SOURCES,
  DATE_USED_DIRECTLY,
  ESLINT,
  ESLINT_ENGINE,
  REPORT_CATALOGUE,
  TEST_BODY_CHECK,
  TEST_BODY_LOGIC,
  WALKER,
} from "../../../tests/report-catalogue.ts";
import type { Finding } from "../../infrastructure/command-line/governance.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { checkOfFinding, type FindingCheck } from "./finding-check.ts";
import type { Check, SymptomCatalogue } from "../language-layer/symptom-catalogue.ts";

const FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const findingOf = (request: Pick<Finding, "clause" | "mechanism"> & Partial<Pick<Finding, "check" | "remedy">>): Finding => ({
  file: FILE,
  anchor: { line: 3, column: 4 },
  snippet: "snippet",
  ...request,
});

const ANGLE_BRACKETS_CHECK: Check = { name: "angle-brackets", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const TWO_CAST_CHECKS: SymptomCatalogue = { ...REPORT_CATALOGUE, checks: [...REPORT_CATALOGUE.checks, ANGLE_BRACKETS_CHECK] };

const BRANCH_REMEDY: Finding["remedy"] = { fix: "write one test per case", page: CHECKS_PAGE, section: "branching-with-if" };

type Row = { readonly name: string; readonly catalogue: SymptomCatalogue; readonly finding: Finding; readonly resolved: FindingCheck };

const ROWS: readonly Row[] = [
  {
    name: "a finding naming a check its engine measures resolves to that check",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: CAST_EXPRESSIONS, mechanism: ESLINT, check: "claimed-type#cast-expressions" }),
    resolved: { resolved: "check", check: CAST_CHECK, engine: ESLINT_ENGINE },
  },
  {
    name: "a finding naming one of two checks of a symptom resolves to the one it names",
    catalogue: TWO_CAST_CHECKS,
    finding: findingOf({ clause: CAST_EXPRESSIONS, mechanism: ESLINT, check: "claimed-type#angle-brackets" }),
    resolved: { resolved: "check", check: ANGLE_BRACKETS_CHECK, engine: ESLINT_ENGINE },
  },
  {
    name: "a finding naming a check its engine does not measure resolves to nothing",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: CAST_EXPRESSIONS, mechanism: AUDIT, check: "claimed-type#cast-expressions" }),
    resolved: { resolved: "none" },
  },
  {
    name: "a finding naming a check the clause lacks resolves to nothing",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: CAST_EXPRESSIONS, mechanism: ESLINT, check: "claimed-type#loops" }),
    resolved: { resolved: "none" },
  },
  {
    name: "a finding naming no check, of a clause that sees one symptom, resolves to the one check of that symptom on its engine",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: CLOCK_SOURCES, mechanism: AUDIT }),
    resolved: { resolved: "check", check: CLOCK_CHECK, engine: WALKER },
  },
  {
    name: "a finding naming no check, read by its remedy's form, resolves to the check of that form's symptom",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: TEST_BODY_LOGIC, mechanism: AUDIT, remedy: BRANCH_REMEDY }),
    resolved: { resolved: "check", check: TEST_BODY_CHECK, engine: WALKER },
  },
  {
    name: "a finding naming no check, whose clause sees no symptom in it, resolves to nothing",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: TEST_BODY_LOGIC, mechanism: AUDIT }),
    resolved: { resolved: "none" },
  },
  {
    name: "a finding naming no check, whose symptom has no check on its engine, resolves to the symptom alone",
    catalogue: REPORT_CATALOGUE,
    finding: findingOf({ clause: CLOCK_SOURCES, mechanism: ESLINT }),
    resolved: { resolved: "symptom-only", symptom: DATE_USED_DIRECTLY },
  },
  {
    name: "a finding naming no check, whose symptom has two checks on its engine, resolves to the symptom alone rather than guess between them",
    catalogue: TWO_CAST_CHECKS,
    finding: findingOf({ clause: CAST_EXPRESSIONS, mechanism: ESLINT }),
    resolved: { resolved: "symptom-only", symptom: CLAIMED_TYPE },
  },
];

describe("checkOfFinding", () => {
  it.each(ROWS)("$name", ({ catalogue, finding, resolved }) => {
    expect(checkOfFinding({ catalogue, finding })).toEqual(resolved);
  });
});
