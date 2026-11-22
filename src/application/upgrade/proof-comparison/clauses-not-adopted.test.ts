import { describe, expect, it } from "vitest";

import type { Finding } from "../../../domain/finding/governance.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { reportWithClausesNotAdopted } from "./clauses-not-adopted.ts";

const AUDIT = "walker" as const;

const SRC_A = repoPathOf("src/a.ts");

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

const WHY = {
  why: "a loop was written",
  because: "it was quicker",
  evidence: "the commit",
} as const;

const WHY_CHAIN = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "no rule at the time",
  owner: "the team",
} as const;

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const finding = (request: { readonly clause: Finding["clause"] }): Finding => ({
  clause: request.clause,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the line",
  mechanism: AUDIT,
});

const clauseWide = (request: { readonly clause: Finding["clause"] }): ExceptionRecord => ({
  kind: "clause-wide-carve-out",
  clause: request.clause,
  mechanism: AUDIT,
  reason: "generated code",
  whyChain: WHY_CHAIN,
});

const fileCarveOut = (request: { readonly clause: Finding["clause"] }): ExceptionRecord => ({
  kind: "file-carve-out",
  clause: request.clause,
  mechanism: AUDIT,
  file: SRC_A,
  reason: "legacy loop",
});

describe("reportWithClausesNotAdopted", () => {
  it("adds each clause to those not adopted", () => {
    expect(
      reportWithClausesNotAdopted({
        report: { ...EMPTY_REPORT, notAdopted: [TEST_BODY_CLAUSE] },
        clauses: [LOOPS_CLAUSE],
      }).notAdopted,
    ).toEqual([TEST_BODY_CLAUSE, LOOPS_CLAUSE]);
  });

  it("drops the findings the clause-wide carve-out answered, which version 2 never raises", () => {
    expect(
      reportWithClausesNotAdopted({
        report: {
          ...EMPTY_REPORT,
          exempted: [
            {
              finding: finding({ clause: LOOPS_CLAUSE }),
              by: [clauseWide({ clause: LOOPS_CLAUSE })],
            },
            {
              finding: finding({ clause: TEST_BODY_CLAUSE }),
              by: [fileCarveOut({ clause: TEST_BODY_CLAUSE })],
            },
          ],
        },
        clauses: [LOOPS_CLAUSE],
      }).exempted,
    ).toEqual([
      {
        finding: finding({ clause: TEST_BODY_CLAUSE }),
        by: [fileCarveOut({ clause: TEST_BODY_CLAUSE })],
      },
    ]);
  });

  it("drops a clause-wide carve-out listed stale or forfeited, which version 2 has no record of", () => {
    const report = reportWithClausesNotAdopted({
      report: {
        ...EMPTY_REPORT,
        stale: [clauseWide({ clause: LOOPS_CLAUSE }), fileCarveOut({ clause: TEST_BODY_CLAUSE })],
        forfeited: [clauseWide({ clause: LOOPS_CLAUSE }), fileCarveOut({ clause: LOOPS_CLAUSE })],
      },
      clauses: [LOOPS_CLAUSE],
    });
    expect({ stale: report.stale, forfeited: report.forfeited }).toEqual({
      stale: [fileCarveOut({ clause: TEST_BODY_CLAUSE })],
      forfeited: [fileCarveOut({ clause: LOOPS_CLAUSE })],
    });
  });

  it("drops the editions of a clause version 2 no longer runs and keeps the others", () => {
    const loopsEdition = {
      address: LOOPS_CLAUSE,
      mechanism: AUDIT,
      edition: editionOf("1"),
      latest: editionOf("2"),
    };
    const testBodyEdition = { ...loopsEdition, address: TEST_BODY_CLAUSE };
    expect(
      reportWithClausesNotAdopted({
        report: { ...EMPTY_REPORT, editions: [loopsEdition, testBodyEdition] },
        clauses: [LOOPS_CLAUSE],
      }).editions,
    ).toEqual([testBodyEdition]);
  });

  it("changes nothing when no clause-wide carve-out was carried", () => {
    const report = {
      ...EMPTY_REPORT,
      notAdopted: [LOOPS_CLAUSE],
      stale: [fileCarveOut({ clause: LOOPS_CLAUSE })],
    };
    expect(reportWithClausesNotAdopted({ report, clauses: [] })).toEqual(report);
  });
});
