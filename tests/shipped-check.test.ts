import { describe, expect, it } from "vitest";
import { TOOL_RULE_SET } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { shippedCheckOf } from "./shipped-check.ts";
import { CAST_CHECK, CLOCK_CHECK, REPORT_CATALOGUE } from "./report-catalogue.ts";

const holding = (request: { readonly checks: typeof REPORT_CATALOGUE.checks }) => ({
  ruleSet: TOOL_RULE_SET,
  catalogue: { ...REPORT_CATALOGUE, checks: request.checks },
});

describe("shippedCheckOf", () => {
  it("gives the one check of that name and discipline", () => {
    const found = shippedCheckOf({ catalogues: [holding({ checks: [CLOCK_CHECK, CAST_CHECK] })], discipline: "CD-2", name: "cast-expressions" });
    expect(found).toEqual(CAST_CHECK);
  });

  it("throws when no catalogue holds a check of that name and discipline", () => {
    expect(() => shippedCheckOf({ catalogues: [holding({ checks: [CLOCK_CHECK] })], discipline: "CD-2", name: "cast-expressions" })).toThrow(
      "the shipped catalogue does not hold exactly one cast-expressions check of CD-2",
    );
  });

  it("throws when several checks share that name and discipline", () => {
    expect(() =>
      shippedCheckOf({ catalogues: [holding({ checks: [CAST_CHECK] }), holding({ checks: [CAST_CHECK] })], discipline: "CD-2", name: "cast-expressions" }),
    ).toThrow("the shipped catalogue does not hold exactly one cast-expressions check of CD-2");
  });
});
