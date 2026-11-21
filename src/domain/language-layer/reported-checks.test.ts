import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { reportedChecksRefusal } from "./reported-checks.ts";
import type { Check, Symptom } from "./symptom-catalogue.ts";

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "A loop.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [], forms: [] };

const CATALOGUE = { checks: [TEST_BODY] };

describe("reportedChecksRefusal", () => {
  it("accepts a report that names no check", () => {
    expect(reportedChecksRefusal({ catalogue: CATALOGUE, reported: [{ clause: LOOPS_CLAUSE }, { clause: TEST_BODY_CLAUSE }] })).toEqual({ outcome: "ok", value: undefined });
  });

  it("accepts a report that names a check its clause has", () => {
    expect(reportedChecksRefusal({ catalogue: CATALOGUE, reported: [{ clause: TEST_BODY_CLAUSE, check: "loop-keyword#test-body" }] })).toEqual({
      outcome: "ok",
      value: undefined,
    });
  });

  it("refuses a report that names a check its clause does not have, as invalid runner output naming the first such entry", () => {
    expect(
      reportedChecksRefusal({
        catalogue: CATALOGUE,
        reported: [{ clause: TEST_BODY_CLAUSE }, { clause: LOOPS_CLAUSE, check: "loop-keyword#test-body" }, { clause: LOOPS_CLAUSE, check: "loop-keyword#loops" }],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "the report names the check loop-keyword#test-body of CD-15#loops, which that clause does not have" },
    });
  });
});
