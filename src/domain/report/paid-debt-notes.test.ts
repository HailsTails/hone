import { describe, expect, it } from "vitest";

import type { ExceptionRecord } from "../records/discipline-exceptions/exception-record.ts";
import { repoPathOf } from "../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { paidDebtNotesOf } from "./paid-debt-notes.ts";

const LOOPS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};
const AUDIT = "walker" as const;
const ESLINT = "eslint" as const;
const BASKET = repoPathOf("src/basket.ts");
const LEGACY = repoPathOf("src/legacy/report.ts");

const ESLINT_CARVE_OUT_ON_BASKET: ExceptionRecord = {
  kind: "file-carve-out",
  clause: LOOPS,
  mechanism: ESLINT,
  file: BASKET,
};

const AUDIT_CARVE_OUT_ON_LEGACY: ExceptionRecord = {
  kind: "file-carve-out",
  clause: LOOPS,
  mechanism: AUDIT,
  file: LEGACY,
};

const BASKET_PAID = { clause: LOOPS, file: BASKET };

const LEGACY_PAID = { clause: LOOPS, file: LEGACY };

const ESLINT_AND_AUDIT_RUNS = [
  { mechanism: ESLINT, projection: "current" },
  { mechanism: AUDIT, projection: "none" },
] as const;

describe("paidDebtNotesOf", () => {
  it("gives no note when a record is stale but no debt is paid", () => {
    expect(
      paidDebtNotesOf({
        governed: { stale: [ESLINT_CARVE_OUT_ON_BASKET], forfeited: [] },
        paid: [],
        runs: ESLINT_AND_AUDIT_RUNS,
      }),
    ).toEqual([]);
  });

  it("names the projecting mechanism of a paid record that is only forfeited", () => {
    expect(
      paidDebtNotesOf({
        governed: { stale: [], forfeited: [ESLINT_CARVE_OUT_ON_BASKET] },
        paid: [BASKET_PAID],
        runs: ESLINT_AND_AUDIT_RUNS,
      }),
    ).toEqual([{ kind: "paid-debt", fileCarveOuts: 1, projections: ["eslint"] }]);
  });

  it("counts each paid pair, naming the projecting mechanism that held one", () => {
    expect(
      paidDebtNotesOf({
        governed: { stale: [ESLINT_CARVE_OUT_ON_BASKET], forfeited: [AUDIT_CARVE_OUT_ON_LEGACY] },
        paid: [BASKET_PAID, LEGACY_PAID],
        runs: ESLINT_AND_AUDIT_RUNS,
      }),
    ).toEqual([{ kind: "paid-debt", fileCarveOuts: 2, projections: ["eslint"] }]);
  });

  it("names no projection for a projecting mechanism whose stale record is not paid", () => {
    expect(
      paidDebtNotesOf({
        governed: { stale: [ESLINT_CARVE_OUT_ON_BASKET], forfeited: [AUDIT_CARVE_OUT_ON_LEGACY] },
        paid: [LEGACY_PAID],
        runs: ESLINT_AND_AUDIT_RUNS,
      }),
    ).toEqual([{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }]);
  });
});
