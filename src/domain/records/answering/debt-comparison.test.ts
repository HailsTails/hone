import { expect, it } from "vitest";

import { repoPathOf } from "../../repository/repo-path-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type { CheckMeasurement } from "../../runner/check-observations.ts";
import type { Debt } from "../hone-records/hone-record.ts";
import { compareDebt } from "./debt-comparison.ts";

const ORDER = repoPathOf("src/order.ts");
const RECEIPT = repoPathOf("src/receipt.ts");
const LEDGER = repoPathOf("hone-records/debt/loop-keyword.json");
const ORDER_LOOP: CheckMeasurement = { check: "loop-keyword#loop-statement", file: ORDER };
const RECEIPT_LOOP: CheckMeasurement = { check: ORDER_LOOP.check, file: RECEIPT };
const DEBT: Debt = {
  kind: "debt",
  file: ORDER,
  symptom: { ruleSet: "hone", name: "loop-keyword" },
  reach: {
    reaches: "one-check",
    check: { name: "loop-statement", symptom: { ruleSet: "hone", name: "loop-keyword" } },
  },
  holding: { held: "stated" },
  findings: 2,
};
const compareWithoutAllowances = (
  request: Omit<Parameters<typeof compareDebt>[0], "debtFindings">,
) => compareDebt({ ...request, debtFindings: request.findings });

const DEBT_PLACEMENT = { place: { file: LEDGER, index: 0 }, record: DEBT };
const SCOPE = {
  kind: "scoped",
  pairs: [ORDER_LOOP, RECEIPT_LOOP],
  inapplicable: [],
} satisfies Parameters<typeof compareDebt>[0]["coverage"];

const MEASURED_INPUT: Parameters<typeof compareWithoutAllowances>[0] = {
  base: { measured: "yes", placements: [DEBT_PLACEMENT] },
  records: [DEBT_PLACEMENT],
  touched: { measured: "pinned-ancestor", paths: new Set([ORDER]), landingRevision: "pinned" },
  ruleSets: ["hone"],
  coverage: SCOPE,
  findings: [ORDER_LOOP, ORDER_LOOP],
  measured: [ORDER_LOOP, RECEIPT_LOOP],
  exceptions: [],
  projection: "current",
};

it("holds the same number of findings with no anchor identity", () => {
  const linesShifted = { ...ORDER_LOOP, anchor: { line: 20, column: 0 } };
  const request = { ...MEASURED_INPUT, findings: [ORDER_LOOP, linesShifted] };

  const compared = compareWithoutAllowances(request);

  expect(compared).toEqual({ revision: "pinned", issues: [] });
});

it("refuses a new finding without pooling across files", () => {
  const request = { ...MEASURED_INPUT, findings: [ORDER_LOOP, RECEIPT_LOOP] };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([{ ...RECEIPT_LOOP, kind: "uncovered", observed: 1 }]);
});

it("takes its ceiling from the landing ledger even when the current row is raised", () => {
  const request = {
    ...MEASURED_INPUT,
    records: [{ place: { file: LEDGER, index: 0 }, record: { ...DEBT, findings: 3 } }],
    findings: [ORDER_LOOP, ORDER_LOOP, ORDER_LOOP],
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([
    { ...ORDER_LOOP, kind: "head-record-changed" },
    { ...ORDER_LOOP, kind: "increased", ceiling: 2, observed: 3 },
  ]);
});

it("distinguishes a measured zero from missing and suppressed coverage", () => {
  const request: Parameters<typeof compareWithoutAllowances>[0] = {
    ...MEASURED_INPUT,
    findings: [],
    measured: [ORDER_LOOP],
    exceptions: [{ ...ORDER_LOOP, kind: "ignore" }],
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([
    { ...ORDER_LOOP, kind: "suppressed" },
    { ...RECEIPT_LOOP, kind: "unmeasured" },
  ]);
});

it("refuses presence-only debt even with a measured zero", () => {
  const { findings: _count, ...presence } = DEBT;
  const request: Parameters<typeof compareWithoutAllowances>[0] = {
    ...MEASURED_INPUT,
    base: {
      measured: "yes",
      placements: [{ ...DEBT_PLACEMENT, record: presence }],
    },
    records: [{ place: { file: LEDGER, index: 0 }, record: presence }],
    findings: [],
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([{ ...ORDER_LOOP, kind: "base-count-missing" }]);
});

it("refuses stale projection coverage and partially read landing data", () => {
  const request: Parameters<typeof compareWithoutAllowances>[0] = {
    ...MEASURED_INPUT,
    base: { measured: "partial", placements: [] },
    projection: "unmeasured",
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([{ kind: "base-refused" }, { kind: "projection-unmeasured" }]);
});

it("checks a finding even when the engine also marked its pair inapplicable", () => {
  const request = {
    ...MEASURED_INPUT,
    coverage: { ...SCOPE, inapplicable: [ORDER_LOOP, RECEIPT_LOOP] },
    measured: [],
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([{ ...ORDER_LOOP, kind: "unmeasured" }]);
});

it("refuses whole-check suppression even when the file check was inapplicable", () => {
  const request: Parameters<typeof compareWithoutAllowances>[0] = {
    ...MEASURED_INPUT,
    measured: [],
    findings: [],
    coverage: { ...SCOPE, inapplicable: [ORDER_LOOP, RECEIPT_LOOP] },
    exceptions: [
      {
        kind: "command-line-option",
        check: ORDER_LOOP.check,
        location: repoPathOf("package.json"),
        script: "typecheck",
        option: "--noCheck",
        cause: { kind: "weakens-run" },
      },
    ],
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([
    { ...ORDER_LOOP, kind: "suppressed" },
    { ...RECEIPT_LOOP, kind: "suppressed" },
  ]);
});

it("refuses measured changes without proof of the pinned landing", () => {
  const compared = compareWithoutAllowances({
    ...MEASURED_INPUT,
    touched: { measured: "yes", paths: new Set([ORDER]) },
  });
  expect(compared.issues).toEqual([{ kind: "base-unavailable" }]);
});

it("refuses an external rule set or changed settings", () => {
  const compared = compareWithoutAllowances({
    ...MEASURED_INPUT,
    touched: {
      measured: "pinned-ancestor",
      paths: new Set([repoPathOf("hone.config.json")]),
      landingRevision: "pinned",
    },
    ruleSets: [{ name: ruleSetNameOf("acme") }],
  });

  expect(compared.issues).toEqual([{ kind: "settings-changed" }, { kind: "external-checks" }]);
});

it("requires landing debt to be check-specific", () => {
  const whole: Debt = { ...DEBT, reach: { reaches: "whole-symptom" } };
  const request: Parameters<typeof compareWithoutAllowances>[0] = {
    ...MEASURED_INPUT,
    base: { measured: "yes", placements: [{ ...DEBT_PLACEMENT, record: whole }] },
    records: [],
    findings: [],
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([
    { kind: "whole-symptom", file: ORDER, symptom: "loop-keyword" },
  ]);
});

it("refuses ambiguous duplicate landing counts", () => {
  const duplicate = { ...DEBT, findings: 4 };
  const request: Parameters<typeof compareWithoutAllowances>[0] = {
    ...MEASURED_INPUT,
    base: {
      measured: "yes",
      placements: [DEBT_PLACEMENT, { place: { file: LEDGER, index: 1 }, record: duplicate }],
    },
  };

  const compared = compareWithoutAllowances(request);

  expect(compared.issues).toEqual([{ kind: "base-refused" }]);
});
