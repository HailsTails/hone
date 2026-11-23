import { describe, expect, it } from "vitest";

import type { Finding } from "../finding/governance.ts";
import type { ExceptionRecord } from "../records/discipline-exceptions/exception-record.ts";
import { repoPathOf } from "../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import type { CheckReport } from "./check-report.ts";
import { verdictOf } from "./verdict.ts";

const RECORDS_FILE = repoPathOf("discipline-exceptions.json");

const noClass = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("no-class-syntax"),
};
const fileA = repoPathOf("src/a.ts");
const audit = "walker" as const;
const eslint = "eslint" as const;

const finding: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: audit,
};

const record: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source:
      "fictional unit fixture core/verdict/verdict.test.ts#record; not historical authorisation",
  },
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
};

const emptyReport: CheckReport = {
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
};

describe("verdictOf", () => {
  it("passes an empty report", () => {
    expect(verdictOf({ report: emptyReport })).toBe("pass");
  });

  it("passes a report whose only entries are excluded paths", () => {
    expect(verdictOf({ report: { ...emptyReport, excluded: [repoPathOf("generated")] } })).toBe(
      "pass",
    );
  });

  it("passes a report whose only entries are exempted findings", () => {
    expect(verdictOf({ report: { ...emptyReport, exempted: [{ finding, by: [record] }] } })).toBe(
      "pass",
    );
  });

  it.each<[string, CheckReport]>([
    ["findings", { ...emptyReport, findings: [finding] }],
    ["uncovered", { ...emptyReport, uncovered: [noClass] }],
    ["stale", { ...emptyReport, stale: [record] }],
    ["forfeited", { ...emptyReport, forfeited: [record] }],
    [
      "unrecorded",
      {
        ...emptyReport,
        unrecorded: [{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }],
      },
    ],
    [
      "doublyHeld",
      { ...emptyReport, doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }] },
    ],
    [
      "invalidRecords",
      {
        ...emptyReport,
        invalidRecords: [
          {
            place: { layout: "single-file", file: RECORDS_FILE, index: 0 },
            problem: {
              kind: "duplicate",
              of: { layout: "single-file", file: RECORDS_FILE, index: 1 },
            },
          },
        ],
      },
    ],
    [
      "unmeasured",
      {
        ...emptyReport,
        unmeasured: [{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }],
      },
    ],
    [
      "legacy-chain unmeasured",
      {
        ...emptyReport,
        unmeasured: [{ kind: "legacy-chain-unmeasured", base: { state: "not-given" } }],
      },
    ],
    [
      "projectionProblems",
      {
        ...emptyReport,
        projectionProblems: [{ scope: "projection", mechanism: eslint, state: "out-of-date" }],
      },
    ],
  ])("fails a report with one %s entry", (_list, report) => {
    expect(verdictOf({ report })).toBe("fail");
  });
});
