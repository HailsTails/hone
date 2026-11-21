import { describe, expect, it } from "vitest";
import { CAST_CHECK, CAST_EXPRESSIONS, CLOCK_CHECK, CLOCK_SOURCES, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE, TEST_BODY_CHECK, TEST_BODY_LOGIC, WALKER } from "../../../../tests/report-catalogue.ts";
import { editionSchema } from "../../../infrastructure/content-files/edition.ts";
import { checksOfClauses, editionsOf } from "./selection-checks.ts";

describe("checksOfClauses", () => {
  it("gives the checks the catalogue holds for each clause, in the clauses' order", () => {
    expect(checksOfClauses({ catalogue: REPORT_CATALOGUE, clauses: [TEST_BODY_LOGIC, CLOCK_SOURCES] })).toEqual([TEST_BODY_CHECK, CLOCK_CHECK]);
  });

  it("gives nothing for a clause the catalogue holds no check for", () => {
    expect(checksOfClauses({ catalogue: { ...REPORT_CATALOGUE, checks: [CAST_CHECK] }, clauses: [CLOCK_SOURCES] })).toEqual([]);
  });
});

describe("editionsOf", () => {
  it("gives the edition each check of a clause ran on the engine of the mechanism that ran it", () => {
    expect(
      editionsOf({
        catalogue: REPORT_CATALOGUE,
        readings: [{ address: CAST_EXPRESSIONS, mechanism: ESLINT, edition: editionSchema.parse("1"), latest: editionSchema.parse("2") }],
      }),
    ).toEqual([{ check: CAST_CHECK, engine: ESLINT_ENGINE, edition: "1", latest: "2" }]);
  });

  it("gives no edition for a check whose engines do not include the mechanism that ran its clause", () => {
    expect(
      editionsOf({
        catalogue: REPORT_CATALOGUE,
        readings: [{ address: CLOCK_SOURCES, mechanism: ESLINT, edition: editionSchema.parse("1"), latest: editionSchema.parse("2") }],
      }),
    ).toEqual([]);
  });

  it("gives the walker for a check the walker runs", () => {
    expect(
      editionsOf({
        catalogue: REPORT_CATALOGUE,
        readings: [{ address: CLOCK_SOURCES, mechanism: WALKER.mechanism, edition: editionSchema.parse("2"), latest: editionSchema.parse("3") }],
      }),
    ).toEqual([{ check: CLOCK_CHECK, engine: WALKER, edition: "2", latest: "3" }]);
  });
});
