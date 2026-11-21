import { describe, expect, it } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../../tests/settings-catalogue.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { checksOfClause } from "./clause-checks.ts";

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: "hone", catalogue: SETTINGS_CATALOGUE }];

describe("checksOfClause", () => {
  it("finds the one check of a clause in its rule set's catalogue", () => {
    expect(checksOfClause({ catalogues: CATALOGUES, clause: LOOPS_CLAUSE })).toEqual([LOOP_KEYWORD_LOOPS]);
  });

  it("finds each check of a clause that has two", () => {
    expect(checksOfClause({ catalogues: CATALOGUES, clause: TEST_BODY_CLAUSE })).toEqual([SETTINGS_CATALOGUE.checks[1], SETTINGS_CATALOGUE.checks[2]]);
  });

  it("finds nothing for a clause that has no check", () => {
    expect(checksOfClause({ catalogues: CATALOGUES, clause: clauseAddressSchema.parse("CD-13#layering") })).toEqual([]);
  });

  it("finds nothing for a clause of a rule set that has no catalogue", () => {
    expect(checksOfClause({ catalogues: CATALOGUES, clause: clauseAddressSchema.parse("team/CD-15#loops") })).toEqual([]);
  });
});
