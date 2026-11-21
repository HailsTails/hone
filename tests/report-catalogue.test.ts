import { describe, expect, it } from "vitest";
import { checkAt, checksOf } from "../src/domain/language-layer/check-address.ts";
import { symptomReadingOf } from "../src/domain/language-layer/symptom-catalogue.ts";
import { BRANCH_IN_A_TEST, CAST_CHECK, CAST_EXPRESSIONS, CHECKS_PAGE, CLOCK_CHECK, CLOCK_SOURCES, REPORT_CATALOGUE, TEST_BODY_CHECK, TEST_BODY_LOGIC } from "./report-catalogue.ts";

describe("REPORT_CATALOGUE is a catalogue its own checks resolve in", () => {
  it.each([
    { address: "date-used-directly#clock-sources", check: CLOCK_CHECK },
    { address: "branch-in-a-test#test-body", check: TEST_BODY_CHECK },
    { address: "claimed-type#cast-expressions", check: CAST_CHECK },
  ])("finds $address", ({ address, check }) => {
    expect(checkAt({ catalogue: REPORT_CATALOGUE, address })).toEqual({ found: "check", check });
  });

  it.each([
    { clause: CLOCK_SOURCES, checks: [CLOCK_CHECK] },
    { clause: TEST_BODY_LOGIC, checks: [TEST_BODY_CHECK] },
    { clause: CAST_EXPRESSIONS, checks: [CAST_CHECK] },
  ])("lists the checks of $clause.ruleSet $clause.discipline", ({ clause, checks }) => {
    expect(checksOf({ catalogue: REPORT_CATALOGUE, clause })).toEqual(checks);
  });

  it("reads a test-body finding's symptom from the form it flagged", () => {
    expect(symptomReadingOf({ catalogue: REPORT_CATALOGUE, finding: { clause: TEST_BODY_LOGIC, remedy: { fix: "write one test per case", page: CHECKS_PAGE, section: "branching-with-if" } } })).toEqual({
      reading: "named",
      symptom: BRANCH_IN_A_TEST,
    });
  });
});
