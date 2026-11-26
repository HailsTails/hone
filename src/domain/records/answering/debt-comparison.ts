import type { CheckAddressText } from "../../language-layer/check-address-text.ts";
import { checkAddressOf } from "../../language-layer/check-address.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import type { CheckMeasurement, CheckNativeException } from "../../runner/check-observations.ts";
import type { Debt, RecordsReading } from "../hone-records/hone-record.ts";

type ComparisonScope =
  | "base-unavailable"
  | "base-refused"
  | "settings-changed"
  | "projection-unmeasured"
  | "no-checks"
  | "external-checks";

type PairProblem = "base-count-missing" | "head-record-changed" | "unmeasured" | "suppressed";

export type DebtComparisonIssue =
  | { readonly kind: ComparisonScope }
  | { readonly kind: "whole-symptom"; readonly file: RepoPath; readonly symptom: string }
  | (CheckMeasurement & { readonly kind: PairProblem })
  | (CheckMeasurement & { readonly kind: "uncovered"; readonly observed: number })
  | (CheckMeasurement & {
      readonly kind: "increased";
      readonly ceiling: number;
      readonly observed: number;
    });

export type DebtComparison = {
  readonly revision: string;
  readonly issues: readonly DebtComparisonIssue[];
};

type Comparing = Pick<RecordsReading, "base" | "records"> & {
  readonly revision: string;
  readonly touched: TouchedSet;
  readonly selected: readonly CheckAddressText[];
  readonly files: readonly RepoPath[];
  readonly findings: readonly CheckMeasurement[];
  readonly measured: readonly CheckMeasurement[];
  readonly exceptions: readonly CheckNativeException[];
  readonly projection: "current" | "unmeasured";
  readonly settings: "unchanged" | "changed";
  readonly checks: "shipped" | "external";
};

type CountedPlace = CheckMeasurement & { readonly findings: number | undefined };

const mapPairToKey = ({ check, file }: CheckMeasurement): string => `${check}:${file}`;

const mapDebtToCountedPlace = (debt: Debt): readonly CountedPlace[] =>
  debt.reach.reaches === "one-check"
    ? [
        {
          check: checkAddressOf({ check: debt.reach.check }),
          file: debt.file,
          findings: debt.findings,
        },
      ]
    : [];

const listWholeSymptomDebt = (debt: Debt): readonly DebtComparisonIssue[] =>
  debt.reach.reaches === "whole-symptom"
    ? [{ kind: "whole-symptom", file: debt.file, symptom: debt.symptom.name }]
    : [];

const compareMeasuredCount = (request: {
  readonly pair: CheckMeasurement;
  readonly counted: ReadonlyMap<string, CountedPlace>;
  readonly observed: ReadonlyMap<string, readonly CheckMeasurement[]>;
  readonly measured: ReadonlySet<string>;
  readonly suppressed: ReadonlySet<string>;
  readonly suppressedChecks: ReadonlySet<CheckAddressText>;
}): readonly DebtComparisonIssue[] => {
  const { pair } = request;
  const address = mapPairToKey(pair);
  const recorded = request.counted.get(address);
  if (recorded !== undefined && recorded.findings === undefined) {
    return [{ ...pair, kind: "base-count-missing" }];
  }
  if (request.suppressed.has(address) || request.suppressedChecks.has(pair.check)) {
    return [{ ...pair, kind: "suppressed" }];
  }
  if (!request.measured.has(address)) {
    return [{ ...pair, kind: "unmeasured" }];
  }
  const ceiling = recorded?.findings;
  const observed = request.observed.get(address)?.length ?? 0;
  if (ceiling === undefined)
    return observed === 0 ? [] : [{ ...pair, kind: "uncovered", observed }];
  return observed > ceiling ? [{ ...pair, kind: "increased", ceiling, observed }] : [];
};

const compareMeasuredDebt = (
  request: Comparing & { readonly base: Extract<Comparing["base"], { readonly measured: "yes" }> },
): readonly DebtComparisonIssue[] => {
  const baseDebts = request.base.held.filter((record) => record.kind === "debt");
  const currentDebts = request.records.flatMap(({ record }) =>
    record.kind === "debt" ? [record] : [],
  );
  const basePlaces = baseDebts.flatMap(mapDebtToCountedPlace);
  const counted = new Map(basePlaces.map((pair) => [mapPairToKey(pair), pair]));
  if (counted.size !== basePlaces.length) return [{ kind: "base-refused" }];
  const scope = request.selected.flatMap((check) => request.files.map((file) => ({ check, file })));
  const compared = new Map(
    [...basePlaces, ...request.findings, ...scope].map(({ check, file }) => {
      const pair = { check, file };
      return [mapPairToKey(pair), pair];
    }),
  );
  const measured = new Set(request.measured.map(mapPairToKey));
  const observed = Map.groupBy(request.findings, mapPairToKey);
  const suppressed = new Set(
    request.exceptions.flatMap((exception) =>
      "file" in exception ? [mapPairToKey(exception)] : [],
    ),
  );
  const suppressedChecks = new Set(
    request.exceptions.flatMap((exception) => ("file" in exception ? [] : [exception.check])),
  );
  return [
    ...baseDebts.flatMap(listWholeSymptomDebt),
    ...currentDebts.flatMap(listWholeSymptomDebt),
    ...currentDebts
      .flatMap(mapDebtToCountedPlace)
      .flatMap(({ check, file, findings }): readonly DebtComparisonIssue[] => {
        const base = counted.get(mapPairToKey({ check, file }));
        return base !== undefined && base.findings === findings
          ? []
          : [{ check, file, kind: "head-record-changed" }];
      }),
    ...[...compared.values()].flatMap((pair) =>
      compareMeasuredCount({ pair, counted, observed, measured, suppressed, suppressedChecks }),
    ),
  ];
};

export const compareDebt = (request: Comparing): DebtComparison => {
  const { base, revision, touched } = request;
  const issues: DebtComparisonIssue[] = [];
  if (base.measured !== "yes" || touched.measured !== "yes")
    return { revision, issues: [{ kind: "base-unavailable" }] };
  if (base.incomplete === true) issues.push({ kind: "base-refused" });
  if (request.settings === "changed") issues.push({ kind: "settings-changed" });
  if (request.projection === "unmeasured") issues.push({ kind: "projection-unmeasured" });
  if (request.selected.length === 0) issues.push({ kind: "no-checks" });
  if (request.checks === "external") issues.push({ kind: "external-checks" });
  return {
    revision,
    issues: issues.length === 0 ? compareMeasuredDebt({ ...request, base }) : issues,
  };
};
